// F15 one-shot demonstration inventory seed (owner-approved). Runs from the deployed application root.
// Inserts the 30 disclosed synthetic listings from f5-demo-catalog.json (each description says
// "Synthetic portfolio listing"; records carry demoOnly + seedBatch "f15-demo"), owned by the single
// Admin under a neutral display name. No users, bookings, payments or availability are created.
// Modes: default = apply (one-shot, guarded); with ".f15-rollback" present = rollback (one-shot).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";

const BATCH = "f15-demo";
const OWNER_NAME = "Equipora demonstration inventory";
const loadEnv = (file) => Object.fromEntries((existsSync(file) ? readFileSync(file, "utf8") : "").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.trimStart().startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1)]));
const claim = (root, name) => { try { writeFileSync(join(root, name), new Date().toISOString(), { flag: "wx", mode: 0o600 }); return true; } catch { return false; } };

export async function main({ root = process.cwd(), env, loadDomain, catalog } = {}) {
  root = resolve(root);
  const config = env ?? { ...loadEnv(join(root, ".env")), ...process.env };
  if (!config.MONGODB_URI) return { result: "BLOCKED", reason: "database_not_configured", changesMade: false };
  const rollback = existsSync(join(root, ".f15-rollback"));
  const mode = rollback ? "rollback" : "apply";
  if (!claim(root, rollback ? ".f15-rollback-consumed" : ".f15-apply-consumed")) return { mode, result: "BLOCKED", reason: mode + "_already_attempted", changesMade: false };
  const client = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db("equipora"), equipment = db.collection("equipment");
    if (rollback) {
      const ids = (await equipment.find({ seedBatch: BATCH }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id));
      const refs = await Promise.all(["reservations", "bookings", "favorites"].map((c) => db.collection(c).countDocuments({ equipmentId: { $in: ids } })));
      if (refs[0] + refs[1] > 0) return { mode, result: "BLOCKED", reason: "demo_items_have_rentals", changesMade: false };
      await db.collection("favorites").deleteMany({ equipmentId: { $in: ids } });
      const r = await equipment.deleteMany({ seedBatch: BATCH });
      return { mode, result: "ROLLED_BACK", removed: r.deletedCount, favoritesRemoved: refs[2], changesMade: r.deletedCount > 0 };
    }
    const admins = await db.collection("user").find({ role: "admin" }, { projection: { _id: 1 } }).toArray();
    if (admins.length !== 1) return { mode, result: "BLOCKED", reason: "expected_exactly_one_admin", admins: admins.length, changesMade: false };
    if (await equipment.countDocuments({ seedBatch: BATCH })) return { mode, result: "BLOCKED", reason: "demo_batch_already_present", changesMade: false };
    const { equipmentSchema } = await (loadDomain ?? (() => import(pathToFileURL(join(root, "dist/domain.js")).href)))();
    const records = catalog ?? JSON.parse(readFileSync(join(root, "f5-demo-catalog.json"), "utf8"));
    if (!Array.isArray(records) || records.length !== 30 || new Set(records.map((r) => r.demoId)).size !== 30)
      return { mode, result: "BLOCKED", reason: "invalid_catalog", changesMade: false };
    const ownerId = String(admins[0]._id), now = Date.now();
    const docs = records.map(({ demoId, demoOnly, sourceCurrency, ...record }, index) => {
      if (!/^EQD-\d{3}$/.test(demoId) || demoOnly !== true) throw new Error("demonstration scope required");
      // Same newest-first stagger as the isolated fixtures: one featured item per category.
      return { ...equipmentSchema.parse(record), demoId, demoOnly: true, demoImageSource: record.image, sourceCurrency, seedBatch: BATCH,
        ownerId, ownerName: OWNER_NAME, ownerImage: "", status: "approved",
        createdAt: new Date(now - (index % 5 === 0 ? index : 100 + index) * 1000), updatedAt: new Date(now), revision: 0 };
    });
    const r = await equipment.insertMany(docs);
    const approved = await equipment.countDocuments({ seedBatch: BATCH, status: "approved" });
    return { mode, result: approved === 30 ? "SEEDED" : "VERIFY_FAILED", inserted: r.insertedCount, approvedInBatch: approved, changesMade: true };
  } catch (e) {
    return { mode, result: "FAILED", reason: e instanceof Error && /scope|parse|invalid/i.test(e.message) ? "catalog_validation_failed" : "operation_failed", changesMade: "check_state" };
  } finally {
    await client.close().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = await main();
  console.log(JSON.stringify(out));
  process.exitCode = ["SEEDED", "ROLLED_BACK"].includes(String(out.result)) ? 0 : 1;
}
