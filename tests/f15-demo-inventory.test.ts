import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain ESM operator script without type declarations
import { main } from "../scripts/f15-demo-inventory.mjs";
import { catalogQuery } from "../src/domain.js";

const catalog = JSON.parse(readFileSync(new URL("../scripts/f5-demo-catalog.json", import.meta.url), "utf8"));
const loadDomain = () => import("../src/domain.js");

test("F15 demo inventory: guarded one-shot seed, six featured categories, safe rollback", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "8.2.1" } });
  const env = { MONGODB_URI: replica.getUri("equipora") };
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db("equipora");
  const dir = () => mkdtempSync(join(tmpdir(), "f15-"));
  try {
    // No admin -> blocked, nothing written.
    assert.equal((await main({ root: dir(), env, loadDomain, catalog })).reason, "expected_exactly_one_admin");
    const adminId = new ObjectId();
    await db.collection("user").insertMany([{ _id: adminId, role: "admin", email: "a@example.test" }, { role: "customer", email: "c@example.test" }]);
    assert.equal(await db.collection("equipment").countDocuments(), 0);

    const root = dir();
    const out = await main({ root, env, loadDomain, catalog });
    assert.equal(out.result, "SEEDED");
    assert.equal(out.inserted, 30);
    assert.equal((await main({ root, env, loadDomain, catalog })).reason, "apply_already_attempted");
    assert.equal((await main({ root: dir(), env, loadDomain, catalog })).reason, "demo_batch_already_present");
    const docs = await db.collection("equipment").find({}).toArray();
    assert.equal(docs.length, 30);
    assert.ok(docs.every((d) => d.demoOnly === true && d.seedBatch === "f15-demo" && d.status === "approved" && d.ownerId === String(adminId) && d.ownerName === "Equipora demonstration inventory"));
    assert.ok(docs.every((d) => /Synthetic portfolio listing/.test(d.description)));
    // Featured query (newest six) yields one item per category.
    const q = catalogQuery({ featured: "true" });
    const featured = await db.collection("equipment").find(q.filter).sort(q.sort as never).limit(q.limit).toArray();
    assert.equal(featured.length, 6);
    assert.equal(new Set(featured.map((d) => d.category)).size, 6);
    // Users untouched.
    assert.equal(await db.collection("user").countDocuments(), 2);

    // Rollback refuses when a demo item has rentals, otherwise removes only the batch.
    await db.collection("reservations").insertOne({ equipmentId: String(docs[0]._id) });
    const rb1 = dir(); writeFileSync(join(rb1, ".f15-rollback"), "");
    assert.equal((await main({ root: rb1, env, loadDomain, catalog })).reason, "demo_items_have_rentals");
    await db.collection("reservations").deleteMany({});
    await db.collection("equipment").insertOne({ name: "Real owner listing", status: "approved" });
    const rb2 = dir(); writeFileSync(join(rb2, ".f15-rollback"), "");
    const rolled = await main({ root: rb2, env, loadDomain, catalog });
    assert.equal(rolled.result, "ROLLED_BACK");
    assert.equal(rolled.removed, 30);
    assert.equal(await db.collection("equipment").countDocuments(), 1, "non-demo listing preserved");
    assert.equal((await main({ root: rb2, env, loadDomain, catalog })).reason, "rollback_already_attempted");
  } finally {
    await client.close();
    await replica.stop();
  }
});
