// F13 one-shot initial-Admin operator script. OWNER APPROVAL REQUIRED before any production run.
// Runs from the deployed application root (where dist/ and the private .env live), e.g. via the
// CloudLinux "Run JS script" control. It never accepts a password, never creates an account and
// never prints the email address, database URI or session data.
//
// Private inputs in the application root (create with mode 0600, outside any public directory):
//   .f13-target.json   {"email": "<owner's existing registered email>"}          (required)
//   .f13-confirm.json  {"accountHash": "<12-hex hash printed by the dry run>"}    (apply)
//   .f13-rollback.json {"accountHash": "<same hash>"}                              (rollback)
// No confirm/rollback file  -> dry run (read-only).
// Apply and rollback are each one-shot, guarded by .f13-apply-consumed / .f13-rollback-consumed.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient, ObjectId } from "mongodb";

const hash = (id) => createHash("sha256").update(String(id)).digest("hex").slice(0, 12);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) out[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return out;
}

async function inspect(db, email) {
  const users = await db.collection("user").find({ email }).project({ _id: 1, role: 1, disabled: 1, createdAt: 1 }).toArray();
  const admins = await db.collection("user").countDocuments({ role: "admin" });
  const marker = await db.collection("bootstrap").findOne({ _id: "initial-admin" });
  const u = users[0];
  const facts = {
    matchingAccounts: users.length,
    accountHash: u ? hash(u._id) : null,
    role: u?.role ?? null,
    disabled: Boolean(u?.disabled),
    registeredOn: u?.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : null,
    existingAdmins: admins,
    bootstrapMarker: Boolean(marker),
  };
  let reason = null;
  if (users.length !== 1) reason = "target_email_must_match_exactly_one_account";
  else if (u.role !== "customer") reason = "target_must_be_customer";
  else if (u.disabled) reason = "target_account_disabled";
  else if (admins) reason = "an_admin_already_exists";
  else if (marker) reason = "initial_admin_bootstrap_already_used";
  return { user: u, facts, reason };
}

function claim(root, name) {
  try { writeFileSync(join(root, name), new Date().toISOString(), { flag: "wx", mode: 0o600 }); return true; }
  catch { return false; }
}

/** @returns {Promise<Record<string, unknown>>} sanitized result; never contains email/URI/session data */
export async function main({ root = process.cwd(), env, loadBootstrap } = {}) {
  root = resolve(root);
  const config = env ?? { ...loadEnv(join(root, ".env")), ...process.env };
  const targetFile = join(root, ".f13-target.json");
  if (!existsSync(targetFile)) return { mode: "none", result: "BLOCKED", reason: "missing_private_target_file" };
  let email;
  try { email = String(readJson(targetFile).email ?? "").trim().toLowerCase(); } catch { return { mode: "none", result: "BLOCKED", reason: "unreadable_target_file" }; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { mode: "none", result: "BLOCKED", reason: "invalid_target_email" };
  if (!config.MONGODB_URI) return { mode: "none", result: "BLOCKED", reason: "database_not_configured" };
  const confirmFile = join(root, ".f13-confirm.json"), rollbackFile = join(root, ".f13-rollback.json");
  const mode = existsSync(rollbackFile) ? "rollback" : existsSync(confirmFile) ? "apply" : "dry-run";
  const client = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db("equipora");
    if (mode === "dry-run") {
      const { facts, reason } = await inspect(db, email);
      return { mode, result: reason ? "BLOCKED" : "READY", reason, ...facts, changesMade: false };
    }
    if (mode === "apply") {
      if (!claim(root, ".f13-apply-consumed")) return { mode, result: "BLOCKED", reason: "apply_already_attempted", changesMade: false };
      const { user, facts, reason } = await inspect(db, email);
      if (reason) return { mode, result: "BLOCKED", reason, ...facts, changesMade: false };
      let confirm;
      try { confirm = String(readJson(confirmFile).accountHash ?? ""); } catch { confirm = ""; }
      if (confirm !== facts.accountHash) return { mode, result: "BLOCKED", reason: "confirmation_hash_mismatch", changesMade: false };
      const { initialAdminPlan, applyInitialAdmin } = await (loadBootstrap ?? (() => import(pathToFileURL(join(root, "dist/admin-bootstrap.js")).href)))();
      const plan = await initialAdminPlan(db, String(user._id), email);
      const s = client.startSession();
      try { await s.withTransaction(() => applyInitialAdmin(db, s, plan)); } finally { await s.endSession(); }
      const after = await db.collection("user").findOne({ _id: user._id }, { projection: { role: 1 } });
      const sessions = await db.collection("session").countDocuments({ userId: user._id });
      const marker = await db.collection("bootstrap").findOne({ _id: "initial-admin" });
      const ok = after?.role === "admin" && sessions === 0 && Boolean(marker);
      return { mode, result: ok ? "PROMOTED" : "VERIFY_FAILED", accountHash: facts.accountHash, roleNow: after?.role ?? null, remainingSessions: sessions, bootstrapMarker: Boolean(marker), changesMade: true };
    }
    // rollback: restore exactly this account to customer, remove the bootstrap marker, revoke its sessions.
    if (!claim(root, ".f13-rollback-consumed")) return { mode, result: "BLOCKED", reason: "rollback_already_attempted", changesMade: false };
    let want;
    try { want = String(readJson(rollbackFile).accountHash ?? ""); } catch { want = ""; }
    const users = await db.collection("user").find({ email }).project({ _id: 1, role: 1 }).toArray();
    if (users.length !== 1 || hash(users[0]._id) !== want) return { mode, result: "BLOCKED", reason: "rollback_target_mismatch", changesMade: false };
    if (users[0].role !== "admin") return { mode, result: "BLOCKED", reason: "target_is_not_admin", changesMade: false };
    const id = new ObjectId(String(users[0]._id));
    const s = client.startSession();
    try {
      await s.withTransaction(async () => {
        const r = await db.collection("user").updateOne({ _id: id, role: "admin" }, { $set: { role: "customer", updatedAt: new Date() } }, { session: s });
        if (r.modifiedCount !== 1) throw new Error("rollback target changed");
        await db.collection("bootstrap").deleteOne({ _id: "initial-admin" }, { session: s });
        await db.collection("session").deleteMany({ userId: id }, { session: s });
      });
    } finally { await s.endSession(); }
    const after = await db.collection("user").findOne({ _id: id }, { projection: { role: 1 } });
    return { mode, result: after?.role === "customer" ? "ROLLED_BACK" : "VERIFY_FAILED", accountHash: want, roleNow: after?.role ?? null, changesMade: true };
  } catch (e) {
    return { mode, result: "FAILED", reason: e instanceof Error && /preconditions|expired|already exists|changed|rejected/i.test(e.message) ? e.message : "operation_failed", changesMade: "unknown_check_state" };
  } finally {
    await client.close().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = await main();
  console.log(JSON.stringify(out));
  process.exitCode = ["READY", "PROMOTED", "ROLLED_BACK"].includes(String(out.result)) ? 0 : 1;
}
