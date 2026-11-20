// F12.3: the production auth configuration (HTTPS frontend origin, NODE_ENV=production) exercised end to end
// against an isolated in-memory MongoDB. This gives automated evidence for the hosted cookie/JWT/revocation
// gates without touching a real browser session or the production database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ObjectId } from "mongodb";
import { once } from "node:events";
import { createLocalJWKSet, jwtVerify, decodeProtectedHeader } from "jose";

const ORIGIN = "https://frontend.example.test";

test("hosted auth: secure host-only cookie, server-trusted role, verified JWT, admin denial and logout revocation", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "8.2.1" } });
  Object.assign(process.env, {
    MONGODB_URI: replica.getUri("equipora"),
    FRONTEND_URL: ORIGIN,
    AUTH_PUBLIC_URL: ORIGIN,
    CORS_ORIGIN: ORIGIN,
    BETTER_AUTH_SECRET: "synthetic-hosted-auth-test-secret-0123456789",
    NODE_ENV: "production",
  });
  const { app } = await import("../src/app.js");
  const { getClient } = await import("../src/db.js");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;
  const call = (path: string, init: { method?: string; body?: unknown; token?: string; cookie?: string; origin?: string | null } = {}) =>
    fetch(base + path, {
      method: init.method ?? "GET",
      headers: {
        ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.token ? { authorization: "Bearer " + init.token } : {}),
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  const cookieOf = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const client = await getClient();
  const db = client.db("equipora");
  try {
    // Registration cannot choose its own role.
    const signUp = await call("/api/auth/sign-up/email", {
      method: "POST",
      body: { name: "Hosted Customer", email: "hosted@example.test", password: "Hosted123", image: "https://i.ibb.co/x/me.png", role: "admin" },
    });
    assert.equal(signUp.status, 200);
    const setCookies = signUp.headers.getSetCookie();
    const session = setCookies.find((c) => c.startsWith("__Secure-better-auth.session_token="));
    assert.ok(session, "session cookie uses the __Secure- prefix on an HTTPS origin");
    const attrs = session.split(";").slice(1).map((a) => a.trim().toLowerCase());
    assert.ok(attrs.includes("httponly"), "HttpOnly");
    assert.ok(attrs.includes("secure"), "Secure");
    assert.ok(attrs.includes("samesite=lax"), "SameSite=Lax");
    assert.ok(attrs.includes("path=/"), "Path=/");
    assert.ok(!attrs.some((a) => a.startsWith("domain=")), "host-only: no Domain attribute");
    const maxAge = Number(attrs.find((a) => a.startsWith("max-age="))?.split("=")[1]);
    assert.equal(maxAge, 60 * 60 * 24 * 7, "7-day session lifetime");
    for (const c of setCookies) assert.ok(/;\s*secure/i.test(c) && /;\s*httponly/i.test(c), "every auth cookie is Secure and HttpOnly");
    const user = await db.collection("user").findOne({ email: "hosted@example.test" });
    assert.equal(user?.role, "customer");
    assert.equal(await db.collection("account").countDocuments({ userId: user!._id, providerId: "credential" }), 1);
    assert.equal(await db.collection("session").countDocuments({ userId: user!._id }), 1);
    const cookie = cookieOf(signUp);

    // Session lookup is consistent and never cached.
    const sessionRes = await call("/api/auth/get-session", { cookie });
    assert.equal(sessionRes.headers.get("cache-control"), "no-store");
    const sessionBody = await sessionRes.json();
    assert.equal(sessionBody.user.role, "customer");
    // Every API response (success or denial) is non-cacheable and hardened.
    for (const path of ["/api/health", "/api/me", "/api/equipment"]) {
      const r = await call(path);
      assert.equal(r.headers.get("cache-control"), "no-store", path);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff", path);
      assert.equal(r.headers.get("x-frame-options"), "DENY", path);
      assert.equal(r.headers.get("x-powered-by"), null, path);
    }

    // JWT: EdDSA-signed by the server's JWKS, issuer/audience = frontend origin, 15-minute lifetime, session-bound.
    const tokenRes = await call("/api/auth/token", { cookie });
    assert.equal(tokenRes.status, 200);
    const { token } = await tokenRes.json();
    const jwks = createLocalJWKSet(await (await call("/api/auth/jwks")).json());
    const { payload } = await jwtVerify(token, jwks, { issuer: ORIGIN, audience: ORIGIN });
    assert.equal(decodeProtectedHeader(token).alg, "EdDSA");
    assert.equal(payload.role, "customer");
    assert.equal(payload.sub, String(user!._id));
    assert.equal((payload.exp as number) - (payload.iat as number), 15 * 60);
    assert.equal(typeof payload.sessionId, "string");

    // Protected API: valid JWT accepted; missing, forged, tampered and unsigned tokens rejected.
    const me = await call("/api/me", { token });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).role, "customer");
    assert.equal((await call("/api/me")).status, 401);
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...payload, role: "admin" })).toString("base64url");
    assert.equal((await call("/api/me", { token: `${h}.${forgedPayload}.${s}` })).status, 401, "tampered payload");
    assert.equal((await call("/api/me", { token: `${Buffer.from('{"alg":"none"}').toString("base64url")}.${p}.` })).status, 401, "alg=none");
    assert.equal((await call("/api/me", { token: "not.a.jwt" })).status, 401);

    // Server-trusted role: the customer cannot reach Admin or Owner endpoints even with a valid JWT.
    assert.equal((await call("/api/admin/users", { token })).status, 403);
    assert.equal((await call("/api/owner/equipment", { token })).status, 403);
    // Profile updates cannot change identity or role.
    const patch = await call("/api/me", { method: "PATCH", token, body: { role: "admin" } });
    assert.ok(patch.status >= 400);
    assert.equal((await db.collection("user").findOne({ _id: user!._id }))?.role, "customer");

    // Origin enforcement on credentialed auth mutations.
    assert.equal((await call("/api/auth/sign-in/email", { method: "POST", origin: "https://untrusted.example", body: { email: "hosted@example.test", password: "Hosted123" } })).status, 403);

    // Logout deletes the server-side session; the old cookie and the still-unexpired JWT stop working.
    const out = await call("/api/auth/sign-out", { method: "POST", cookie, body: {} });
    assert.equal(out.status, 200);
    assert.ok(out.headers.getSetCookie().some((c) => c.startsWith("__Secure-better-auth.session_token=;") || /max-age=0/i.test(c)), "cookie cleared");
    assert.equal(await db.collection("session").countDocuments({ userId: user!._id }), 0);
    assert.equal(await (await call("/api/auth/get-session", { cookie })).json(), null);
    assert.equal((await call("/api/me", { token })).status, 401, "JWT bound to the revoked session is rejected");

    // Re-login works and yields exactly one active session.
    const signIn = await call("/api/auth/sign-in/email", { method: "POST", body: { email: "hosted@example.test", password: "Hosted123" } });
    assert.equal(signIn.status, 200);
    const cookie2 = cookieOf(signIn);
    const sessions = await (await call("/api/auth/list-sessions", { cookie: cookie2 })).json();
    assert.equal(sessions.length, 1);
    const token2 = (await (await call("/api/auth/token", { cookie: cookie2 })).json()).token;
    assert.equal((await call("/api/me", { token: token2 })).status, 200);

    // Rate limiting behind the gateway (no client IP => one shared bucket, as in production):
    // routine session reads and token issuance must never be throttled ...
    const reads = await Promise.all(Array.from({ length: 130 }, (_, i) => call(i % 2 ? "/api/auth/get-session" : "/api/auth/token", { cookie: cookie2 })));
    assert.deepEqual([...new Set(reads.map((r) => r.status))], [200], "no 429 for routine session reads");
    // ... while credential endpoints keep the strict brute-force limit.
    const attempts = [];
    for (let i = 0; i < 5; i++)
      attempts.push((await call("/api/auth/sign-in/email", { method: "POST", body: { email: "hosted@example.test", password: "Wrong-Password1" } })).status);
    assert.ok(attempts.includes(429), "sign-in burst is throttled: " + attempts.join(","));
    assert.ok(new ObjectId(String(user!._id)));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await client.close();
    await replica.stop();
  }
});
