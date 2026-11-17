import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { handler } from '../netlify/functions/egress-observer.js';
import { matchesRules, OBSERVER_EXPIRES, observationHTTP, observePublicIPv4, observerDependencies, signObservation } from '../src/egress-observer.js';

test('fixed HTTPS observation verifies certificates and bounds redirects, parsing and time', async t => {
  let mode = 'ok';
  let captured: Record<string, unknown>;
  t.mock.method(observationHTTP, 'request', (options: Record<string, unknown>, callback: (response: EventEmitter) => void) => {
    captured = options;
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(): void };
    req.destroy = () => {};
    req.end = () => {
      if (mode === 'timeout') return;
      if (mode === 'certificate') { queueMicrotask(() => req.emit('error', Object.assign(new Error('secret-canary'), { code: 'CERT_HAS_EXPIRED' }))); return; }
      const response = Object.assign(new EventEmitter(), { statusCode: mode === 'redirect' ? 302 : 200, headers: {}, destroy() {} });
      callback(response);
      queueMicrotask(() => {
        response.emit('data', Buffer.from(mode === 'large' ? 'x'.repeat(65) : mode === 'invalid' ? 'secret-canary' : '8.8.8.8\n'));
        response.emit('end');
      });
    };
    return req;
  });
  assert.equal(await observePublicIPv4(), '8.8.8.8');
  assert.deepEqual(captured!, { hostname: 'checkip.amazonaws.com', port: 443, path: '/', method: 'GET', family: 4,
    rejectUnauthorized: true, servername: 'checkip.amazonaws.com', headers: { accept: 'text/plain' } });
  for (mode of ['redirect', 'large', 'invalid', 'certificate']) await assert.rejects(observePublicIPv4(), { message: 'observation_failed' });
  mode = 'timeout';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = assert.rejects(observePublicIPv4(), { message: 'observation_failed' });
  t.mock.timers.tick(1500); await pending;
});

test('private CIDR comparison handles prefix boundaries', () => {
  assert.equal(matchesRules('8.8.8.8', ['8.8.8.0/24']), true);
  assert.equal(matchesRules('8.8.9.8', ['8.8.8.0/24']), false);
  assert.equal(matchesRules('8.8.8.8', ['8.8.8.8/32']), true);
  assert.equal(matchesRules('8.8.8.9', ['8.8.8.8/32']), false);
});

test('real Blobs claim uses atomic only-if-new and fails closed on storage errors', async t => {
  let calls = 0;
  let fail = false;
  t.mock.method(globalThis, 'fetch', async (_input: unknown, init: RequestInit) => {
    calls++;
    assert.equal(new Headers(init.headers).get('if-none-match'), '*');
    assert.equal(init.body, '{"consumed":true}');
    if (fail) return new Response('', { status: 503 });
    return new Response('', { status: calls === 1 ? 200 : 412, headers: calls === 1 ? { etag: 'synthetic-etag' } : {} });
  });
  const event = { blobs: Buffer.from(JSON.stringify({ url: 'https://example.invalid', token: 'synthetic-token' })).toString('base64'),
    headers: { 'x-nf-site-id': 'synthetic-site', 'x-nf-deploy-id': 'synthetic-deploy' } };
  assert.equal(await observerDependencies.claim(event), true);
  assert.equal(await observerDependencies.claim(event), false);
  fail = true;
  await assert.rejects(observerDependencies.claim(event));
  assert.equal(calls, 3, 'storage failures must not cause SDK retries');
});

test('actual exported handler authenticates first, validates integrity/freshness, prevents replay and never discloses addresses', async t => {
  const key = 'synthetic-diagnostic-key';
  const oldKey = process.env.DIAGNOSTIC_KEY;
  process.env.DIAGNOSTIC_KEY = key;
  let now = OBSERVER_EXPIRES - 600_000;
  t.mock.method(Date, 'now', () => now);
  let claims = 0; let observations = 0; let connections = 0; let consumed = false; let gateFails = false;
  const logs: string[] = [];
  t.mock.method(console, 'info', (value: string) => logs.push(value));
  t.mock.method(observerDependencies, 'claim', async () => { claims++; if (gateFails) throw new Error('secret-canary'); if (consumed) return false; consumed = true; return true; });
  t.mock.method(observerDependencies, 'observe', async () => { observations++; return '8.8.8.8'; });
  t.mock.method(observerDependencies, 'connect', async () => { connections++; return { connected: false, category: 'tls_alert_internal', stage: 'tls' }; });
  const input = { nonce: 'a'.repeat(64), issuedAt: now, rules: ['8.8.8.0/24'] };
  const signed = { ...input, mac: signObservation(input, key) };
  const call = async (body: unknown, auth = key, extraHeaders = {}) => handler({ httpMethod: 'POST', headers: {
    'content-type': 'application/json', 'x-diagnostic-key': auth, ...extraHeaders,
  }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  try {
    for (const auth of ['', 'invalid']) {
      assert.equal((await call('{secret-canary', auth)).statusCode, 404);
      assert.equal((await call('x'.repeat(4000), auth)).statusCode, 404);
    }
    assert.equal(claims, 0); assert.equal(observations, 0); assert.equal(connections, 0);
    assert.equal((await call('{secret-canary')).statusCode, 400);
    assert.equal((await call('x'.repeat(4000))).statusCode, 413);
    assert.equal((await call(signed, key, { 'content-type': 'text/plain' })).statusCode, 415);
    assert.equal((await call({ ...signed, destination: 'https://example.invalid' })).statusCode, 400);
    assert.equal((await call({ ...signed, rules: ['0.0.0.0/0'] })).statusCode, 400);
    assert.equal((await call({ ...signed, nonce: 'b'.repeat(64) })).statusCode, 403);
    assert.equal((await call({ ...signed, issuedAt: now - 121_000 })).statusCode, 400);
    assert.equal(claims, 0);
    gateFails = true;
    assert.equal((await call(signed)).statusCode, 503);
    assert.equal(observations, 0); gateFails = false;
    const result = await handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-diagnostic-key': key },
      body: Buffer.from(JSON.stringify(signed)) });
    assert.equal(result.statusCode, 200);
    const parsed = JSON.parse(result.body);
    assert.equal(parsed.beforePermitted, true); assert.equal(parsed.afterPermitted, true);
    assert.equal(parsed.observationsConsistent, true); assert.equal(connections, 1); assert.equal(observations, 2);
    assert.doesNotMatch(result.body + logs.join(''), /8\.8\.8|synthetic|secret-canary|nonce|mac/);
    assert.equal((await call(signed)).statusCode, 409);
    assert.equal(connections, 1); assert.equal(observations, 2);
    now = OBSERVER_EXPIRES;
    assert.equal((await call(signed)).statusCode, 404);
  } finally { if (oldKey === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = oldKey; }
});

test('handler reports changed or unpermitted observations without returning identifiers', async t => {
  const oldKey = process.env.DIAGNOSTIC_KEY;
  process.env.DIAGNOSTIC_KEY = 'synthetic-key';
  const now = OBSERVER_EXPIRES - 600_000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(console, 'info', () => {});
  t.mock.method(observerDependencies, 'claim', async () => true);
  let calls = 0;
  t.mock.method(observerDependencies, 'observe', async () => ++calls === 1 ? '8.8.8.8' : '8.8.9.8');
  t.mock.method(observerDependencies, 'connect', async () => ({ connected: true, category: 'ok', stage: 'connected' }));
  const input = { nonce: 'b'.repeat(64), issuedAt: now, rules: ['8.8.8.8/32'] };
  try {
    const response = await handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-diagnostic-key': 'synthetic-key' },
      body: Buffer.from(JSON.stringify({ ...input, mac: signObservation(input, 'synthetic-key') })).toString('base64'), isBase64Encoded: true });
    const result = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(result.beforePermitted, true);
    assert.equal(result.afterPermitted, false);
    assert.equal(result.observationsConsistent, false);
    assert.doesNotMatch(response.body, /8\.8\.|synthetic|nonce|mac/);
  } finally { if (oldKey === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = oldKey; }
});
