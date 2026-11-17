import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { MongoClient } from 'mongodb';
import { app } from '../src/app.js';
import { getClient } from '../src/db.js';

test('health authorization, safe failures, retry, and connection reuse', async (t) => {
  const original = { uri: process.env.MONGODB_URI, key: process.env.DIAGNOSTIC_KEY };
  const logs: string[] = [];
  t.mock.method(console, 'error', (line: string) => logs.push(line));
  let attempts = 0;
  let failure: unknown = { code: 18, message: 'secret-canary' };
  t.mock.method(MongoClient.prototype, 'connect', async function (this: MongoClient) {
    attempts++;
    if (failure) throw failure;
    return this;
  });
  t.mock.method(MongoClient.prototype, 'db', () => ({ command: async () => ({ ok: 1 }) }));
  // Synthetic, non-routable URI; the connection method is mocked.
  process.env.MONGODB_URI = 'mongodb://example.invalid/equipora';
  process.env.DIAGNOSTIC_KEY = 'synthetic-test-key';
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const request = (path: string, key?: string) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: key ? { 'x-diagnostic-key': key } : {},
  });
  try {
    const health = await request('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal((await health.json()).ok, true);
    for (const key of [undefined, 'invalid']) {
      const denied = await request('/api/health/db', key);
      assert.equal(denied.status, 404);
      assert.deepEqual(await denied.json(), { ok: false });
    }
    delete process.env.DIAGNOSTIC_KEY;
    assert.equal((await request('/api/health/db', 'synthetic-test-key')).status, 404);
    assert.equal(attempts, 0);
    assert.equal(logs.length, 0);
    process.env.DIAGNOSTIC_KEY = 'synthetic-test-key';
    delete process.env.MONGODB_URI;
    const missing = await request('/api/health/db', 'synthetic-test-key');
    assert.equal(missing.status, 503);
    assert.deepEqual(await missing.json(), { ok: false, database: 'unavailable' });
    assert.deepEqual(JSON.parse(logs.pop()!), { event: 'database_health_failure', stage: 'connect', category: 'missing_configuration' });
    process.env.MONGODB_URI = 'invalid-uri-secret-canary';
    const invalid = await request('/api/health/db', 'synthetic-test-key');
    assert.equal(invalid.status, 503);
    assert.deepEqual(await invalid.json(), { ok: false, database: 'unavailable' });
    assert.deepEqual(JSON.parse(logs.pop()!), { event: 'database_health_failure', stage: 'connect', category: 'invalid_configuration' });
    process.env.MONGODB_URI = 'mongodb://example.invalid/equipora';
    for (const [error, category] of [
      [{ code: 18 }, 'authentication'], [{ code: 13 }, 'permission'],
      [{ code: 'ENOTFOUND' }, 'dns'], [{ name: 'MongoServerSelectionError' }, 'connection_timeout'],
    ] as const) {
      failure = { ...error, message: 'secret-canary', stack: 'secret-canary' };
      const unavailable = await request('/api/health/db', 'synthetic-test-key');
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), { ok: false, database: 'unavailable' });
      assert.deepEqual(JSON.parse(logs.pop()!), { event: 'database_health_failure', stage: 'connect', category });
    }
    failure = undefined;
    const clients = await Promise.all([getClient(), getClient(), getClient()]);
    assert.equal(new Set(clients).size, 1);
    assert.equal(attempts, 5); // Four rejected attempts, then one shared success.
    const reachable = await request('/api/health/db', 'synthetic-test-key');
    assert.equal(reachable.status, 200);
    assert.deepEqual(await reachable.json(), { ok: true, database: 'reachable' });
    assert.equal(attempts, 5);
    t.mock.method(MongoClient.prototype, 'db', () => ({ command: async () => { throw { code: 13, message: 'secret-canary' }; } }));
    assert.equal((await request('/api/health/db', 'synthetic-test-key')).status, 503);
    assert.deepEqual(JSON.parse(logs.pop()!), { event: 'database_health_failure', stage: 'ping', category: 'permission' });
    assert.equal((await request('/api/missing')).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    for (const [name, value] of [['MONGODB_URI', original.uri], ['DIAGNOSTIC_KEY', original.key]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
