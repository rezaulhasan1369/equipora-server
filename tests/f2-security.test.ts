import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import {
  validateProviders,
  providerText,
  providerJSON,
  isStripeTestSecret,
} from "../src/local-provider-config.js";
import { stripe } from "../src/marketplace.js";
import { initialAdminPlan, applyInitialAdmin } from "../src/admin-bootstrap.js";
test("documented Stripe test formats pass configuration and runtime without rewriting credentials", () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  try {
    for (const key of ["sk_test_synthetic", "rkcs_test_synthetic123"]) {
      assert.equal(isStripeTestSecret(key), true);
      assert.equal(validateProviders({ STRIPE_SECRET_KEY: key }).STRIPE_SECRET_KEY, key);
      process.env.STRIPE_SECRET_KEY = key;
      assert.ok(stripe()); // Constructs SDK only; no provider request.
    }
    for (const key of ["", "sk_test_", "rkcs_test_", "rk_test_synthetic", "sk_live_synthetic", "rkcs_live_synthetic", "pk_test_synthetic", "rkcs_test_bad-key", "rkcs_test_bad_key", "RKCS_test_synthetic", " rkcs_test_synthetic", "rkcs_test_synthetic\n", "rkcs_test_synthetic\0", "rkcs_test_" + "x".repeat(4096)]) {
      assert.equal(isStripeTestSecret(key), false);
      if (key) assert.throws(() => validateProviders({ STRIPE_SECRET_KEY: key }));
      // Windows environment assignment truncates at NUL; validate that input
      // before it reaches the environment rather than testing a changed value.
      if (key.includes("\0")) continue;
      process.env.STRIPE_SECRET_KEY = key;
      assert.throws(() => stripe(), e => e instanceof Error && !e.message.includes("synthetic"));
    }
  } finally {
    if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous;
  }
});
test("private provider configuration fails closed without echoing inputs", () => {
  for (const input of [
    { MONGODB_URI: "private-canary" },
    { STRIPE_SECRET_KEY: "sk_live_canary" },
    { GOOGLE_CLIENT_ID: "only-id.apps.googleusercontent.com" },
    { IMGBB_API_KEY: "private\ncanary" },
  ])
    assert.throws(
      () => validateProviders(input),
      (e) => e instanceof Error && !e.message.includes("private-canary"),
    );
  assert.deepEqual(providerText("IMGBB_API_KEY=synthetic-local-only"), {
    IMGBB_API_KEY: "synthetic-local-only",
  });
  assert.throws(() => providerText("X".repeat(24577)));
  assert.throws(()=>providerJSON('private-secret-canary'),e=>e instanceof Error&&!e.message.includes('private-secret-canary'));
});
test("initial Admin bootstrap is existing-account only, atomic, scoped and revokes sessions", async () => {
  const replica = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "8.2.1" },
    }),
    client = await new MongoClient(replica.getUri()).connect();
  try {
    const db = client.db("equipora"),
      id = new ObjectId();
    await db
      .collection("user")
      .insertOne({
        _id: id,
        email: "bootstrap@example.test",
        role: "customer",
        name: "Local Operator",
      });
    await db
      .collection("session")
      .insertOne({ userId: id, expiresAt: new Date(Date.now() + 60000) });
    await assert.rejects(
      initialAdminPlan(db, String(id), "wrong@example.test"),
    );
    await assert.rejects(
      initialAdminPlan(
        client.db("other"),
        String(id),
        "bootstrap@example.test",
      ),
    );
    const plan = await initialAdminPlan(
      db,
      String(id),
      "bootstrap@example.test",
    );
    await client.withSession((s) =>
      s.withTransaction(() => applyInitialAdmin(db, s, plan)),
    );
    assert.equal(
      (await db.collection("user").findOne({ _id: id }))!.role,
      "admin",
    );
    assert.equal(
      await db.collection("session").countDocuments({ userId: id }),
      0,
    );
    await assert.rejects(
      initialAdminPlan(db, String(id), "bootstrap@example.test"),
    );
    await assert.rejects(
      client.withSession((s) =>
        s.withTransaction(() => applyInitialAdmin(db, s, plan)),
      ),
    );
    assert.equal(
      await db.collection("user").countDocuments({ role: "admin" }),
      1,
    );
  } finally {
    await client.close();
    await replica.stop();
  }
});
