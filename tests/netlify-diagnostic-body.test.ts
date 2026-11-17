import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MongoClient } from 'mongodb';
import { handler } from '../netlify/functions/api.js';
import { createConfigProof, networkDependencies } from '../src/db-network-diagnostics.js';

test('actual Netlify handler authenticates before bounded diagnostic Buffer parsing', async t => {
  const oldUri = process.env.MONGODB_URI;
  const oldKey = process.env.DIAGNOSTIC_KEY;
  const uri = 'mongodb+srv://equipora_app:synthetic-password@cluster.synthetic.mongodb.net/equipora';
  const key = 'synthetic-key';
  process.env.MONGODB_URI = uri;
  process.env.DIAGNOSTIC_KEY = key;
  let probes = 0;
  let connections = 0;
  let unauthorizedParses = 0;
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  t.mock.method(networkDependencies, 'srv', async () => { probes++; return [{ name: 'node.synthetic.mongodb.net', port: 27017, weight: 0, priority: 0 }]; });
  t.mock.method(networkDependencies, 'txt', async () => []);
  t.mock.method(networkDependencies, 'addresses', async () => []);
  t.mock.method(MongoClient.prototype, 'connect', async function (this: MongoClient) { connections++; return this; });
  t.mock.method(MongoClient.prototype, 'db', () => ({ command: async () => ({ ok: 1 }) }));
  const parse = JSON.parse;
  t.mock.method(JSON, 'parse', (text: string, ...rest: unknown[]) => {
    if (typeof text === 'string' && text.includes('unauthorized-canary')) unauthorizedParses++;
    return parse(text, ...rest);
  });
  const payload = JSON.stringify({ expected: createConfigProof(uri, key) });
  const invoke = async ({
    body = payload, auth = key as string | undefined, type = 'application/json',
    path = '/api/health/db/diagnostics', method = 'POST', base64 = false,
    extraHeaders = {} as Record<string, string>, query = {} as Record<string, string>,
  } = {}) => {
    const result = await handler({
      httpMethod: method, path, headers: { 'content-type': type, ...(auth ? { 'x-diagnostic-key': auth } : {}), ...extraHeaders },
      body, isBase64Encoded: base64, queryStringParameters: query, requestContext: {},
    }, {});
    const parsed = parse(result.body);
    assert.doesNotMatch(result.body, /synthetic-password|synthetic-key|mongodb\.net|127\.0\.0\.1|secret-canary|unauthorized-canary|SyntaxError|stack/);
    return { ...result, parsed };
  };
  const rejection = async (options: Parameters<typeof invoke>[0], code: number) => {
    const before = probes;
    const result = await invoke(options);
    assert.equal(result.statusCode, code);
    assert.deepEqual(result.parsed, { ok: false });
    assert.equal(probes, before);
  };
  try {
    await t.test('missing and invalid keys cannot parse or probe, even malformed or oversized payloads', async () => {
      for (const auth of ['', 'invalid']) {
        for (const body of ['{"unauthorized-canary":true}', '{unauthorized-canary', 'unauthorized-canary' + 'x'.repeat(3000)]) {
          await rejection({ auth, body }, 404);
        }
      }
      assert.equal(unauthorizedParses, 0);
      assert.equal(probes, 0);
      delete process.env.DIAGNOSTIC_KEY;
      await rejection({ body: '{unauthorized-canary' }, 404);
      assert.equal(unauthorizedParses, 0);
      process.env.DIAGNOSTIC_KEY = key;
    });
    await t.test('malformed, oversized, empty, unsupported and invalid-schema inputs are sanitized', async () => {
      await rejection({ body: '{secret-canary' }, 400);
      await rejection({ body: JSON.stringify({ padding: 'x'.repeat(2048) }) }, 413);
      await rejection({ body: payload, extraHeaders: { 'content-length': '2049' } }, 413);
      await rejection({ body: '' }, 400);
      await rejection({ body: 'null' }, 400);
      await rejection({ body: '[]' }, 400);
      await rejection({ type: 'text/plain' }, 415);
      await rejection({ type: 'application/json; charset=latin1' }, 415);
      await rejection({ extraHeaders: { 'content-encoding': 'gzip' } }, 415);
      await rejection({ body: Buffer.from([0xff, 0xfe]) as unknown as string }, 400);
      await rejection({ body: JSON.stringify({ expected: {}, hostname: 'localhost' }) }, 400);
      await rejection({ query: { host: 'localhost' } }, 400);
      await rejection({ extraHeaders: { 'content-length': '1' } }, 400);
      assert.equal(probes, 0);
    });
    await t.test('valid authenticated JSON is parsed from adapter Buffer and invokes fixed-target probes', async () => {
      const result = await invoke();
      assert.equal(result.statusCode, 200);
      assert.equal(result.headers['cache-control'], 'no-store');
      assert.deepEqual(result.parsed.configuration, { cluster: true, database: true, authentication: true, connectionOptions: true });
      assert.equal(result.parsed.network.servers.length, 1);
      assert.equal(probes, 1);
    });
    await t.test('literal Buffer and base64 event bodies retain the same validated schema', async () => {
      for (const options of [
        { body: Buffer.from(payload) as unknown as string },
        { body: Buffer.from(payload).toString('base64'), base64: true },
      ]) {
        clock += 31_000;
        assert.equal((await invoke(options)).statusCode, 200);
      }
      assert.equal(probes, 3);
    });
    await t.test('health and database-health authorization remain unchanged through actual handler', async () => {
      assert.equal((await invoke({ path: '/api/health', method: 'GET', body: '' })).statusCode, 200);
      await rejection({ path: '/api/health/db', method: 'GET', body: '', auth: '' }, 404);
      await rejection({ path: '/api/health/db', method: 'GET', body: '', auth: 'invalid' }, 404);
      assert.equal(connections, 0);
      const result = await invoke({ path: '/api/health/db', method: 'GET', body: '' });
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.parsed, { ok: true, database: 'reachable' });
      assert.equal(connections, 1);
    });
  } finally {
    if (oldUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = oldUri;
    if (oldKey === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = oldKey;
  }
});
