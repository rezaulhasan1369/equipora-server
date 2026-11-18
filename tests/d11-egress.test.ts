import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { handler, deps, mac, DEADLINE } from '../netlify/functions/d11-egress.js';

const key = 'test-key-never-used-in-production';
function request(phase: 'capture' | 'verify', issuedAt: number, capsule?: unknown, authorization = key) {
  const fields = phase === 'capture'
    ? { phase, nonce: randomBytes(32).toString('hex'), issuedAt }
    : { phase, nonce: randomBytes(32).toString('hex'), issuedAt, capsule };
  return handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', 'x-diagnostic-key': authorization },
    body: JSON.stringify({ ...fields, mac: mac(key, fields) }) });
}

test('D1.1 authenticated short-lived capture and verify; no IP disclosure', async t => {
  const old = process.env.DIAGNOSTIC_KEY;
  process.env.DIAGNOSTIC_KEY = key;
  let now = DEADLINE - 30 * 60_000;
  t.mock.method(Date, 'now', () => now);
  let claims = 0; let connects = 0;
  t.mock.method(deps, 'claim', async () => { claims++; return true; });
  t.mock.method(deps, 'observe', async () => '8.8.8.8');
  t.mock.method(deps, 'connectAndPing', async () => {
    connects++;
    return { connected: connects === 2, category: connects === 2 ? 'ok' : 'tls_alert_internal', stage: connects === 2 ? 'connected' : 'tls',
      tls: connects === 2 ? 'established' : 'failed_before_secure', mongodbHandshake: connects === 2 ? 'completed' : 'not_observed' };
  });
  try {
    const bad = await request('capture', now, undefined, 'bad-key');
    assert.equal(bad.statusCode, 404); assert.equal(claims, 0);
    const response = await request('capture', now);
    assert.equal(response.statusCode, 200);
    const captured = JSON.parse(response.body);
    assert.equal(captured.ok, true);
    assert.equal(captured.driver.connected, false);
    assert.doesNotMatch(response.body, /8\.8\.8\.8|test-key-never-used-in-production/);
    now += 1000;
    const verified = await request('verify', now, captured.capsule);
    assert.equal(verified.statusCode, 200);
    assert.deepEqual(JSON.parse(verified.body).matchingEgress, true);
    assert.equal(JSON.parse(verified.body).driver.connected, true);
    assert.equal(claims, 2);
    now = DEADLINE;
    assert.equal((await request('capture', now)).statusCode, 404);
  } finally {
    if (old === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = old;
  }
});

test('D1.1 verify stops before connecting if egress changes', async t => {
  const old = process.env.DIAGNOSTIC_KEY;
  process.env.DIAGNOSTIC_KEY = key;
  const now = DEADLINE - 20 * 60_000;
  t.mock.method(Date, 'now', () => now);
  let ip = '8.8.8.8'; let connections = 0;
  t.mock.method(deps, 'claim', async () => true);
  t.mock.method(deps, 'observe', async () => ip);
  t.mock.method(deps, 'connectAndPing', async () => {
    connections++;
    return { connected: false, category: 'tls_alert_internal', stage: 'tls', tls: 'failed_before_secure', mongodbHandshake: 'not_observed' };
  });
  try {
    const first = JSON.parse((await request('capture', now)).body);
    assert.equal(first.ok, true);
    assert.equal(connections, 1);
    ip = '8.8.4.4';
    const result = JSON.parse((await request('verify', now, first.capsule)).body);
    assert.equal(result.category, 'egress_changed_before_connect');
    assert.equal(connections, 1);
  } finally {
    if (old === undefined) delete process.env.DIAGNOSTIC_KEY; else process.env.DIAGNOSTIC_KEY = old;
  }
});
