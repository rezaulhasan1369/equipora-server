import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain ESM operator script without type declarations
import { main } from "../scripts/f13-initial-admin.mjs";

const loadBootstrap = () => import("../src/admin-bootstrap.js");

test("F13 operator script: dry run, confirmed one-shot promotion, guards and rollback", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "8.2.1" } });
  const env = { MONGODB_URI: replica.getUri("equipora") };
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db("equipora");
  const ownerId = new ObjectId(), otherId = new ObjectId(), disabledId = new ObjectId();
  await db.collection("user").insertMany([
    { _id: ownerId, email: "owner.person@example.test", role: "customer", createdAt: new Date("2026-11-20") },
    { _id: otherId, email: "someone@example.test", role: "customer", createdAt: new Date() },
    { _id: disabledId, email: "disabled@example.test", role: "customer", disabled: true, createdAt: new Date() },
  ]);
  await db.collection("session").insertMany([{ userId: ownerId, token: "a" }, { userId: ownerId, token: "b" }, { userId: otherId, token: "c" }]);
  const dir = (target?: object, extra: Record<string, object> = {}) => {
    const d = mkdtempSync(join(tmpdir(), "f13-"));
    if (target) writeFileSync(join(d, ".f13-target.json"), JSON.stringify(target));
    for (const [name, value] of Object.entries(extra)) writeFileSync(join(d, name), JSON.stringify(value));
    return d;
  };
  const run = (root: string) => main({ root, env, loadBootstrap });
  try {
    assert.equal((await run(dir())).reason, "missing_private_target_file");
    assert.equal((await run(dir({ email: "not-an-email" }))).reason, "invalid_target_email");
    assert.equal((await run(dir({ email: "nobody@example.test" }))).reason, "target_email_must_match_exactly_one_account");
    assert.equal((await run(dir({ email: "disabled@example.test" }))).reason, "target_account_disabled");

    // Dry run is read-only and reports only sanitized facts.
    const dry = await run(dir({ email: "  Owner.Person@Example.test " }));
    assert.equal(dry.result, "READY");
    assert.equal(dry.changesMade, false);
    assert.match(String(dry.accountHash), /^[a-f0-9]{12}$/);
    assert.ok(!JSON.stringify(dry).includes("owner.person"), "email never echoed");
    assert.equal((await db.collection("user").findOne({ _id: ownerId }))?.role, "customer");

    // Wrong confirmation hash: blocked, nothing changed, and the one-shot apply is spent.
    const wrong = dir({ email: "owner.person@example.test" }, { ".f13-confirm.json": { accountHash: "000000000000" } });
    assert.equal((await run(wrong)).reason, "confirmation_hash_mismatch");
    assert.equal((await run(wrong)).reason, "apply_already_attempted");
    assert.equal((await db.collection("user").findOne({ _id: ownerId }))?.role, "customer");
    assert.equal(await db.collection("session").countDocuments({ userId: ownerId }), 2);

    // Confirmed apply promotes exactly the target, revokes only its sessions and records the marker.
    const ok = dir({ email: "owner.person@example.test" }, { ".f13-confirm.json": { accountHash: dry.accountHash } });
    const applied = await run(ok);
    assert.equal(applied.result, "PROMOTED");
    assert.equal(applied.remainingSessions, 0);
    assert.ok(existsSync(join(ok, ".f13-apply-consumed")));
    assert.equal((await db.collection("user").findOne({ _id: ownerId }))?.role, "admin");
    assert.equal((await db.collection("user").findOne({ _id: otherId }))?.role, "customer");
    assert.equal(await db.collection("session").countDocuments({ userId: otherId }), 1);
    assert.ok(await db.collection("bootstrap").findOne({ _id: "initial-admin" as unknown as ObjectId }));
    assert.equal((await run(ok)).reason, "apply_already_attempted");

    // No second initial Admin, for anyone.
    assert.equal((await run(dir({ email: "someone@example.test" }))).reason, "an_admin_already_exists");
    const second = await run(dir({ email: "someone@example.test" }, { ".f13-confirm.json": { accountHash: "x" } }));
    assert.equal(second.result, "BLOCKED");
    assert.equal((await db.collection("user").findOne({ _id: otherId }))?.role, "customer");

    // Rollback restores exactly that account and removes the marker; it is one-shot too.
    const badRollback = dir({ email: "owner.person@example.test" }, { ".f13-rollback.json": { accountHash: "ffffffffffff" } });
    assert.equal((await run(badRollback)).reason, "rollback_target_mismatch");
    const rb = dir({ email: "owner.person@example.test" }, { ".f13-rollback.json": { accountHash: dry.accountHash } });
    assert.equal((await run(rb)).result, "ROLLED_BACK");
    assert.equal((await db.collection("user").findOne({ _id: ownerId }))?.role, "customer");
    assert.equal(await db.collection("bootstrap").countDocuments({}), 0);
    assert.equal((await run(rb)).reason, "rollback_already_attempted");
    assert.equal((await run(dir({ email: "owner.person@example.test" }))).result, "READY");
  } finally {
    await client.close();
    await replica.stop();
  }
});
