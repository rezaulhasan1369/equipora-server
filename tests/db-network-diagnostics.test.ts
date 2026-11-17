import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { app } from '../src/app.js';
import {
  compareConfigProof, createConfigProof, networkDependencies, probeTransport,
  runNetworkDiagnostics, validConfigProof, isPublicProbeAddress,
} from '../src/db-network-diagnostics.js';

const uri = 'mongodb+srv://app:synthetic-password@cluster.synthetic.mongodb.net/equipora';
const key = 'synthetic-diagnostic-key';
const target = { name: 'node.synthetic.mongodb.net', port: 27017, weight: 0, priority: 0 };

test('configuration proofs exclude credentials and distinguish safe settings', () => {
  const proof = createConfigProof(uri, key);
  assert.ok(validConfigProof(proof));
  assert.equal(validConfigProof({ ...proof, host: 'example.invalid' }), false);
  assert.equal(validConfigProof({ ...proof, cluster: 'not-a-proof' }), false);
  assert.deepEqual(compareConfigProof(proof, proof), { cluster: true, database: true, authentication: true, connectionOptions: true });
  const changed = compareConfigProof(proof, createConfigProof(uri.replace('synthetic-password', 'different'), key));
  assert.deepEqual(changed, { cluster: true, database: true, authentication: true, connectionOptions: true });
  assert.deepEqual(proof, createConfigProof(uri.replace('synthetic-password', 'different'), key));
  assert.equal(compareConfigProof(proof, createConfigProof(`${uri}?connectTimeoutMS=2000`, key)).connectionOptions, false);
  assert.equal(compareConfigProof(proof, createConfigProof(uri.replace('cluster.', 'other.'), key)).cluster, false);
  assert.equal(compareConfigProof(proof, createConfigProof(uri.replace('/equipora', '/other'), key)).database, false);
  assert.equal(compareConfigProof(proof, createConfigProof(`${uri}?authSource=admin`, key)).authentication, false);
  assert.equal(JSON.stringify(proof).includes('synthetic-password'), false);
});

test('bounded Atlas targets and aggregate network results contain no connection details', async () => {
  let transports = 0;
  const dependencies = {
    ...networkDependencies,
    srv: async () => Array.from({ length: 5 }, (_, i) => ({ ...target, name: `node${i}.synthetic.mongodb.net` })),
    txt: async () => [['authSource=admin']],
    addresses: async (_name: string, family: 4 | 6) => {
      if (family === 6) throw { code: 'ENODATA', message: 'secret-canary' };
      return ['8.8.8.8']; // Synthetic; transport is mocked and never connects.
    },
    transport: async () => { transports++; return { tcp: 'ok' as const, tls: 'ok' as const }; },
  };
  const result = await runNetworkDiagnostics(uri, dependencies);
  assert.equal(result.supported, true);
  assert.equal(result.servers?.length, 3);
  assert.equal(transports, 3);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.servers?.[0], { ipv4: { dns: 'ok', tcp: 'ok', tls: 'ok' }, ipv6: { dns: 'no_records', tcp: 'skipped', tls: 'skipped' } });
  assert.doesNotMatch(JSON.stringify(result), /mongodb\.net|192\.0\.2|synthetic-password|secret-canary|authSource/);
  for (const rejected of [
    'mongodb://localhost/equipora', uri.replace('mongodb.net', 'example.com'),
    `${uri}?tls=false`, `${uri}?tlsAllowInvalidCertificates=true`, `${uri}?tlsAllowInvalidHostnames=true`, `${uri}?proxyHost=localhost`,
  ]) assert.deepEqual(await runNetworkDiagnostics(rejected, dependencies), { supported: false });
  for (const bad of [{ ...target, name: 'unrelated.mongodb.net' }, { ...target, port: 80 }]) {
    const rejected = await runNetworkDiagnostics(uri, { ...dependencies, srv: async () => [bad] });
    assert.equal(rejected.targetsAccepted, false);
  }
  const dnsFailure = await runNetworkDiagnostics(uri, { ...dependencies, srv: async () => { throw { code: 'ETIMEOUT', message: 'secret-canary' }; } });
  assert.equal(dnsFailure.dns?.srv, 'timeout');
  assert.deepEqual(dnsFailure.servers, []);
  const blocked = await runNetworkDiagnostics(uri, { ...dependencies, addresses: async () => ['127.0.0.1'] });
  assert.equal(blocked.servers?.[0].ipv4.tcp, 'skipped');
  assert.equal(transports, 3);
});

test('nonpublic DNS answers cannot become probe targets', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '192.0.2.1']) {
    assert.equal(isPublicProbeAddress(address, 4), false);
  }
  for (const address of ['::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) {
    assert.equal(isPublicProbeAddress(address, 6), false);
  }
  assert.equal(isPublicProbeAddress('8.8.8.8', 4), true);
  assert.equal(isPublicProbeAddress('2606:4700:4700::1111', 6), true);
});

test('DNS deadline cancels outstanding resolver work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = 0;
  t.mock.method(Resolver.prototype, 'resolveSrv', () => new Promise(() => {}));
  t.mock.method(Resolver.prototype, 'cancel', () => { cancelled++; });
  const result = networkDependencies.srv('_mongodb._tcp.cluster.synthetic.mongodb.net', new AbortController().signal);
  const rejected = assert.rejects(result);
  t.mock.timers.tick(1200);
  await rejected;
  assert.equal(cancelled, 1);
});

test('TCP/TLS probes honor cancellation and close sockets', async () => {
  const sockets = new Set<import('node:net').Socket>();
  const server = createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const controller = new AbortController();
  const pending = probeTransport({ name: 'localhost', port: address.port }, '127.0.0.1', 4, controller.signal);
  await once(server, 'connection');
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  assert.deepEqual(await pending, { tcp: 'ok', tls: 'handshake_timeout' });
  assert.deepEqual(await probeTransport(target, '192.0.2.1', 4, controller.signal), { tcp: 'timeout', tls: 'skipped' });
  for (const socket of sockets) socket.destroy();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

test('new endpoint authenticates first, refuses target input, compares privately and throttles', async t => {
  const oldUri = process.env.MONGODB_URI;
  const oldKey = process.env.DIAGNOSTIC_KEY;
  process.env.MONGODB_URI = uri;
  process.env.DIAGNOSTIC_KEY = key;
  let probes = 0;
  t.mock.method(networkDependencies, 'srv', async () => { probes++; return [target]; });
  t.mock.method(networkDependencies, 'txt', async () => []);
  t.mock.method(networkDependencies, 'addresses', async () => []);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const call = (body: unknown, auth?: string, query = '') => fetch(`http://127.0.0.1:${address.port}/api/health/db/diagnostics${query}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { 'x-diagnostic-key': auth } : {}) }, body: JSON.stringify(body),
  });
  try {
    for (const auth of [undefined, 'invalid']) assert.equal((await call({}, auth)).status, 404);
    const expected = createConfigProof(uri, key);
    for (const body of [{ host: 'localhost' }, { expected, uri }, { expected: { ...expected, uri: 'invalid' } }]) {
      assert.equal((await call(body, key)).status, 400);
    }
    assert.equal((await call({ expected }, key, '?host=localhost')).status, 400);
    for (const auth of [undefined, key]) {
      const malformed = await fetch(`http://127.0.0.1:${address.port}/api/health/db/diagnostics`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { 'x-diagnostic-key': auth } : {}) }, body: '{secret-canary',
      });
      assert.equal(malformed.status, auth ? 400 : 404);
      assert.deepEqual(await malformed.json(), { ok: false });
    }
    assert.equal(probes, 0);
    const response = await call({ expected }, key);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.deepEqual(result.configuration, { cluster: true, database: true, authentication: true, connectionOptions: true });
    assert.doesNotMatch(JSON.stringify(result), /synthetic|mongodb\.net|authSource/);
    assert.equal((await call({ expected }, key)).status, 429);
    assert.equal(probes, 1);
    let clock = Date.now() + 31_000;
    t.mock.method(Date, 'now', () => clock);
    delete process.env.MONGODB_URI;
    const missing = await call({ expected }, key);
    assert.equal(missing.status, 503);
    assert.deepEqual(await missing.json(), { ok: false, category: 'missing_configuration' });
    clock += 31_000;
    process.env.MONGODB_URI = 'secret-canary-invalid-uri';
    const invalid = await call({ expected }, key);
    assert.equal(invalid.status, 503);
    assert.deepEqual(await invalid.json(), { ok: false, category: 'invalid_configuration' });
    clock += 31_000;
    process.env.MONGODB_URI = uri;
    let release!: () => void;
    let started!: () => void;
    const busy = new Promise<void>(resolve => { started = resolve; });
    t.mock.method(networkDependencies, 'srv', async () => {
      started();
      await new Promise<void>(resolve => { release = resolve; });
      return [target];
    });
    const first = call({ expected }, key);
    await busy;
    clock += 31_000; // Still rejected while another probe is running.
    assert.equal((await call({ expected }, key)).status, 429);
    release();
    assert.equal((await first).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (oldUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = oldUri;
    if (oldKey === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = oldKey;
  }
});
