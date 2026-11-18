/** Equipora D1.1: short-lived, authenticated, one-use-per-phase diagnostic. */
import { createHmac, hkdfSync, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { connectLambda, getStore } from '@netlify/blobs';
import { MongoClient } from 'mongodb';
import { observePublicIPv4 } from '../../src/egress-observer.js';
import { observeDriverConnection } from '../../src/db-driver-diagnostics.js';

const PROJECT = '6afcf056600c4272fc7fc315';
const DEADLINE = Date.parse('2026-11-19T00:30:00Z');
const STORE = 'equipora-operator-diagnostics';
const DOMAIN = 'equipora-d11-v1';
const MAX_BODY = 4096;
const reply = (statusCode: number, body: unknown) => ({ statusCode, headers: {
  'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
}, body: JSON.stringify(body) });
type Event = { httpMethod?: string; headers?: Record<string, string>; body?: string | Buffer | null; isBase64Encoded?: boolean };
type Capsule = { iv: string; ciphertext: string; tag: string };
function mac(key: string, obj: Record<string, unknown>) {
  return createHmac('sha256', key).update(`${DOMAIN}:request:`).update(JSON.stringify(obj)).digest('hex');
}
function encrypt(key: string, ip: string, time: number): Capsule {
  const derived = Buffer.from(hkdfSync('sha256', Buffer.from(key), Buffer.from(PROJECT), Buffer.from(`${DOMAIN}:aes-gcm`), 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derived, iv);
  cipher.setAAD(Buffer.from(`${DOMAIN}:${PROJECT}`));
  const plaintext = Buffer.from(JSON.stringify({ ip, time, project: PROJECT }));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv: iv.toString('hex'), ciphertext: ciphertext.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}
function decrypt(key: string, capsule: Capsule) {
  if (!capsule || !/^[0-9a-f]{24}$/.test(capsule.iv) || !/^[0-9a-f]{32}$/.test(capsule.tag) ||
      typeof capsule.ciphertext !== 'string' || !/^[0-9a-f]{20,512}$/.test(capsule.ciphertext) || capsule.ciphertext.length % 2) throw Error('invalid');
  const derived = Buffer.from(hkdfSync('sha256', Buffer.from(key), Buffer.from(PROJECT), Buffer.from(`${DOMAIN}:aes-gcm`), 32));
  const decipher = createDecipheriv('aes-256-gcm', derived, Buffer.from(capsule.iv, 'hex'));
  decipher.setAAD(Buffer.from(`${DOMAIN}:${PROJECT}`));
  decipher.setAuthTag(Buffer.from(capsule.tag, 'hex'));
  const result = JSON.parse(Buffer.concat([decipher.update(Buffer.from(capsule.ciphertext, 'hex')), decipher.final()]).toString());
  if (result.project !== PROJECT || isIP(result.ip) !== 4 || !Number.isSafeInteger(result.time) ||
      Date.now() - result.time > 120000 || result.time > Date.now() + 5000) throw Error('expired');
  return result as { ip: string; time: number };
}
async function claim(event: Event, phase: string) {
  connectLambda(event as Parameters<typeof connectLambda>[0]);
  let bad = false;
  const store = getStore({ name: STORE, fetch: async (input, init) => {
    try {
      const response = await fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(2000) });
      if (response.status === 200 || response.status === 412) return response;
      await response.body?.cancel();
    } catch { /* Fail closed, do not retry. */ }
    bad = true;
    return new Response(null, { status: 412 });
  } });
  const r = await store.setJSON(`equipora-d11-${phase}-20261118`, { used: true }, { onlyIfNew: true });
  if (bad || (r.modified && !r.etag)) throw Error('gate_unavailable');
  return r.modified;
}
async function connectAndPing() {
  const client = new MongoClient(process.env.MONGODB_URI ?? '', { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 });
  try {
    return await observeDriverConnection(async attach => {
      attach(client);
      await client.connect();
      await client.db('equipora').command({ ping: 1 });
      return client;
    });
  } finally { await client.close().catch(() => undefined); }
}
const deps = { claim, observe: observePublicIPv4, connectAndPing };
export { deps, DEADLINE, mac };
export async function handler(event: Event) {
  const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const key = process.env.DIAGNOSTIC_KEY;
  if (!key || !headers['x-diagnostic-key'] ||
      Buffer.byteLength(headers['x-diagnostic-key']) !== Buffer.byteLength(key) ||
      !timingSafeEqual(Buffer.from(headers['x-diagnostic-key']), Buffer.from(key)) ||
      event.httpMethod !== 'POST' || Date.now() >= DEADLINE) return reply(404, { ok: false });
  if (headers['content-type'] !== 'application/json' || headers['content-encoding']) return reply(415, { ok: false });
  let input: Record<string, unknown>;
  let phase: string;
  let capsule: Capsule | undefined;
  try {
    const raw = Buffer.isBuffer(event.body) ? event.body : Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8');
    if (raw.length > MAX_BODY) return reply(413, { ok: false });
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    if (!input || Array.isArray(input) || typeof input !== 'object') throw Error('shape');
    phase = input.phase as string;
    if (phase !== 'capture' && phase !== 'verify') throw Error('phase');
    const keys = Object.keys(input).sort().join(',');
    if (keys !== (phase === 'capture' ? 'issuedAt,mac,nonce,phase' : 'capsule,issuedAt,mac,nonce,phase')) throw Error('keys');
    if (typeof input.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(input.nonce) ||
        !Number.isSafeInteger(input.issuedAt) || Math.abs(Date.now() - (input.issuedAt as number)) > 120000 ||
        typeof input.mac !== 'string' || !/^[a-f0-9]{64}$/.test(input.mac)) throw Error('validation');
    capsule = phase === 'verify' ? input.capsule as Capsule : undefined;
    const data = phase === 'capture' ? { phase, nonce: input.nonce, issuedAt: input.issuedAt } :
      { phase, nonce: input.nonce, issuedAt: input.issuedAt, capsule };
    const expected = mac(key, data);
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.mac, 'hex'))) return reply(403, { ok: false });
  } catch { return reply(400, { ok: false }); }
  let candidate: { ip: string; time: number } | undefined;
  if (phase! === 'verify') {
    try { candidate = decrypt(key, capsule!); } catch { return reply(400, { ok: false }); }
  }
  try { if (!await deps.claim(event, phase!)) return reply(409, { ok: false, category: 'already_consumed' }); }
  catch { return reply(503, { ok: false, category: 'gate_unavailable' }); }
  try {
    const before = await deps.observe();
    if (phase! === 'verify' && before !== candidate!.ip) return reply(200, { ok: false, category: 'egress_changed_before_connect' });
    const driver = await deps.connectAndPing();
    const after = await deps.observe();
    if (before !== after) return reply(200, { ok: false, category: 'egress_changed_during_connect' });
    const sanitized = { connected: driver.connected === true, category: driver.category, stage: driver.stage, tls: driver.tls,
      mongodbHandshake: driver.mongodbHandshake };
    if (phase! === 'capture') return reply(200, { ok: true, capsule: encrypt(key, before, Date.now()), driver: sanitized });
    return reply(200, { ok: true, matchingEgress: before === candidate!.ip, driver: sanitized });
  } catch { return reply(503, { ok: false, category: 'observation_failed' }); }
}
