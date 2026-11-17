import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';
import { channel } from 'node:diagnostics_channel';
import { test } from 'node:test';
import { MongoClient } from 'mongodb';
import { handler } from '../netlify/functions/api.js';
import { classifyDatabaseFailure, classifyTransportFailure } from '../src/db-diagnostics.js';
import { observeDriverConnection } from '../src/db-driver-diagnostics.js';
import { createConfigProof, networkDependencies, probeTransport } from '../src/db-network-diagnostics.js';

test('fixed transport categories and nested driver causes never echo raw fields', () => {
  for (const [code, category] of [
    ['ECONNRESET', 'connection_reset'], ['EPIPE', 'premature_close'],
    ['ETIMEDOUT', 'handshake_timeout'], ['CERT_HAS_EXPIRED', 'certificate_error'],
    ['ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', 'tls_alert_internal'],
    ['ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE', 'tls_alert_handshake_failure'],
    ['ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'tls_alert_protocol_version'],
    ['secret-canary', 'unknown_network_error'],
  ] as const) {
    assert.equal(classifyTransportFailure({ code, message: 'secret-canary' }), category);
  }
  const nested = { name: 'MongoServerSelectionError', reason: { servers: new Map([
    ['private-host', { error: new AggregateError([Object.assign(new Error('secret-canary'), {
      cause: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', stack: 'secret-canary' },
    })], 'secret-canary') }],
  ]) } };
  assert.equal(classifyDatabaseFailure(nested), 'tls_alert_internal');
});

async function withPeer(mode: string, run: (port: number) => Promise<void>) {
  const sockets = new Set<net.Socket>();
  const server = mode === 'alert' ? tls.createServer({}) : net.createServer(socket => {
    if (mode === 'reset') socket.once('data', () => socket.resetAndDestroy());
    if (mode === 'eof') socket.once('data', () => socket.end());
  });
  server.on('tlsClientError', () => {});
  server.on('connection', socket => {
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try { await run(address.port); }
  finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('controlled real TLS peers distinguish resets, EOF, alerts and deadlines', async () => {
  for (const [mode, expected] of [
    ['reset', 'connection_reset'], ['eof', 'premature_close'],
    ['alert', 'tls_alert_handshake_failure'], ['silent', 'handshake_timeout'],
  ] as const) {
    await withPeer(mode, async port => {
      const result = await probeTransport({ name: 'localhost', port }, '127.0.0.1', 4, new AbortController().signal);
      assert.deepEqual(result, { tcp: 'ok', tls: expected });
    });
  }
});

test('genuine driver TLS observation is scoped, sanitized and removed after completion', async () => {
  const sockets = channel('net.client.socket');
  const subscribedBefore = sockets.hasSubscribers;
  await withPeer('alert', async port => {
    const result = await observeDriverConnection(async attach => {
      const client = new MongoClient(`mongodb://127.0.0.1:${port}/equipora?tls=true`, { serverSelectionTimeoutMS: 250 });
      attach(client);
      try { return await client.connect(); } finally { await client.close(); }
    });
    assert.equal(result.connected, false);
    assert.equal(result.stage, 'tls');
    assert.equal(result.tls, 'failed_before_secure');
    assert.equal(result.mongodbHandshake, 'not_observed');
    assert.ok(result.failureCategories.includes('tls_alert_handshake_failure'));
    assert.equal(result.category, 'tls_alert_handshake_failure');
    assert.doesNotMatch(JSON.stringify(result), /127\.0\.0\.1|mongodb:|localhost|Error:|stack/);
  });
  assert.equal(sockets.hasSubscribers, subscribedBefore);
  await withPeer('silent', async port => {
    const pending = await observeDriverConnection(async attach => {
      const client = new MongoClient(`mongodb://127.0.0.1:${port}/equipora?tls=true`, { serverSelectionTimeoutMS: 250 });
      attach(client);
      try { return await client.connect(); } finally { await client.close(); }
    });
    assert.equal(pending.category, 'connection_timeout');
    assert.equal(pending.stage, 'tls');
    assert.equal(pending.mongodbHandshake, 'not_observed');
    assert.notEqual(pending.tls, 'established');
  });
  await withPeer('alert', async port => {
    // Schedule outside the observer's async scope: this socket must be ignored.
    const outside = new Promise<void>((resolve, reject) => setImmediate(async () => {
      try { await probeTransport({ name: 'localhost', port }, '127.0.0.1', 4, new AbortController().signal); resolve(); }
      catch (error) { reject(error); }
    }));
    const isolated = await observeDriverConnection(async () => {
      await outside;
      return new MongoClient('mongodb://example.invalid/equipora');
    });
    assert.equal(isolated.tls, 'not_observed');
    assert.deepEqual(isolated.failureCategories, []);
  });
  const unobserved = await observeDriverConnection(async attach => {
    const client = new MongoClient('mongodb://example.invalid/equipora');
    attach(client);
    client.emit('serverHeartbeatSucceeded', {} as never);
    return client;
  });
  assert.equal(unobserved.tls, 'not_observed');
  assert.equal(unobserved.mongodbHandshake, 'completed');
});

test('actual Netlify handler gates driver instrumentation and returns/logs only fixed categories', async t => {
  const original = { uri: process.env.MONGODB_URI, key: process.env.DIAGNOSTIC_KEY };
  const uri = 'mongodb+srv://equipora_app:synthetic-password@cluster.synthetic.mongodb.net/equipora';
  const key = 'synthetic-key';
  process.env.MONGODB_URI = uri; process.env.DIAGNOSTIC_KEY = key;
  let attempts = 0;
  let probes = 0;
  const logs: string[] = [];
  t.mock.method(console, 'error', (value: string) => logs.push(value));
  t.mock.method(networkDependencies, 'srv', async () => { probes++; return [{ name: 'node.synthetic.mongodb.net', port: 27017, weight: 0, priority: 0 }]; });
  t.mock.method(networkDependencies, 'txt', async () => []);
  t.mock.method(networkDependencies, 'addresses', async (_name: string, family: number) => family === 4 ? ['8.8.8.8'] : []);
  t.mock.method(networkDependencies, 'transport', async () => ({ tcp: 'ok', tls: 'tls_alert_internal' }));
  t.mock.method(MongoClient.prototype, 'connect', async () => {
    attempts++;
    throw { name: 'MongoServerSelectionError', cause: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', message: 'secret-canary' }, message: uri, stack: key };
  });
  const invoke = async (auth: string) => handler({
    httpMethod: 'POST', path: '/api/health/db/diagnostics', headers: { 'content-type': 'application/json', 'x-diagnostic-key': auth },
    body: JSON.stringify({ expected: createConfigProof(uri, key) }), isBase64Encoded: false, queryStringParameters: {}, requestContext: {},
  }, {});
  try {
    for (const auth of ['', 'invalid']) assert.equal((await invoke(auth)).statusCode, 404);
    assert.equal(attempts, 0); assert.equal(probes, 0); assert.equal(logs.length, 0);
    const result = await invoke(key);
    const body = JSON.parse(result.body);
    assert.equal(result.statusCode, 200);
    assert.equal(attempts, 1);
    assert.equal(body.driver.category, 'tls_alert_internal');
    // A mocked driver supplies no socket evidence: never invent a TLS-stage observation.
    assert.equal(body.driver.stage, 'unobserved');
    assert.equal(body.driver.tls, 'not_observed');
    assert.equal(logs.length, 1);
    assert.doesNotMatch(result.body + logs.join(''), /secret-canary|synthetic|mongodb\.net|stack|ERR_SSL/);
    assert.equal(JSON.parse(logs[0]).event, 'database_driver_diagnostic');
  } finally {
    if (original.uri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = original.uri;
    if (original.key === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = original.key;
  }
});
