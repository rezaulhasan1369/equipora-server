import { createHmac, timingSafeEqual } from 'node:crypto';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { connectLambda, getStore } from '@netlify/blobs';
import { MongoClient } from 'mongodb';
import { observeDriverConnection } from './db-driver-diagnostics.js';

export const OBSERVER_EXPIRES = Date.parse('2026-11-18T00:30:00Z');
export const OBSERVER_ID = 'equipora-d1-0-single-observation';
type Input = { nonce: string; issuedAt: number; rules: string[]; mac: string };
export function signObservation(input: Omit<Input, 'mac'>, key: string) {
  return createHmac('sha256', key).update('equipora-egress-d1:').update(JSON.stringify(input)).digest('hex');
}
function publicV4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split('.').map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127);
}
function validRule(rule: string) {
  const [ip, prefix = '32', ...extra] = rule.split('/');
  return !extra.length && isIP(ip) === 4 && /^(?:2[4-9]|3[0-2])$/.test(prefix);
}
export function matchesRules(ip: string, rules: string[]) {
  const number = (value: string) => value.split('.').reduce((n, part) => (n * 256 + Number(part)) >>> 0, 0);
  return rules.some(rule => {
    const [base, prefix = '32'] = rule.split('/');
    const mask = (0xffffffff << (32 - Number(prefix))) >>> 0;
    return (number(ip) & mask) === (number(base) & mask);
  });
}

// Fixed HTTPS destination; no application headers, redirects, or raw response logs.
export const observationHTTP = { request };
export function observePublicIPv4(): Promise<string> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let req: ReturnType<typeof request>;
    const timer = setTimeout(() => finish(), 1500);
    const finish = (ip?: string) => {
      if (finished) return;
      finished = true; clearTimeout(timer); req?.destroy();
      if (ip) resolve(ip); else reject(new Error('observation_failed'));
    };
    req = observationHTTP.request({ hostname: 'checkip.amazonaws.com', port: 443, path: '/', method: 'GET',
      family: 4, rejectUnauthorized: true, servername: 'checkip.amazonaws.com',
      headers: { accept: 'text/plain' },
    }, response => {
      if (response.statusCode !== 200 || response.headers['content-encoding'] ||
          Number(response.headers['content-length'] ?? 0) > 64) { response.destroy(); finish(); return; }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 64) { response.destroy(); finish(); } else chunks.push(chunk);
      });
      response.on('end', () => {
        const value = Buffer.concat(chunks).toString('utf8').trim();
        finish(publicV4(value) ? value : undefined);
      });
      response.on('error', () => finish());
      response.on('aborted', () => finish());
    });
    req.on('error', () => finish()); req.end();
  });
}

export const observerDependencies = {
  observe: observePublicIPv4,
  claim: async (event: unknown) => {
    connectLambda(event as Parameters<typeof connectLambda>[0]);
    let failed = false;
    // No reads/read-then-writes: onlyIfNew is the atomic server-side condition.
    const store = getStore({ name: 'equipora-operator-diagnostics',
      fetch: async (input, init) => {
        try {
          const response = await fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(2000) });
          if (response.status === 200 || response.status === 412) return response;
          await response.body?.cancel();
        } catch { /* Never let the SDK retry storage failures. */ }
        failed = true;
        // A synthetic failed precondition suppresses SDK retries; checked below.
        return new Response(null, { status: 412 });
      },
    });
    const result = await store.setJSON(OBSERVER_ID, { consumed: true }, { onlyIfNew: true });
    if (failed || (result.modified && !result.etag)) throw new Error('gate_failed');
    return result.modified;
  },
  connect: async () => {
    const client = new MongoClient(process.env.MONGODB_URI ?? '', { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 });
    try {
      return await observeDriverConnection(async attach => { attach(client); return client.connect(); });
    } finally { await client.close(); }
  },
};

type Event = { httpMethod?: string; headers?: Record<string, string>; body?: string | Buffer | null; isBase64Encoded?: boolean };
export async function handleObservation(event: Event) {
  const reply = (statusCode: number, value: unknown) => ({ statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(value) });
  const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const key = process.env.DIAGNOSTIC_KEY;
  // No parsing, storage operation, or outbound work before authentication.
  if (!key || headers['x-diagnostic-key'] !== key || Date.now() >= OBSERVER_EXPIRES || event.httpMethod !== 'POST') return reply(404, { ok: false });
  if (headers['content-type'] !== 'application/json' || headers['content-encoding']) return reply(415, { ok: false });
  let input: Input;
  try {
    if (typeof event.body === 'string' && event.body.length > 2800) return reply(413, { ok: false });
    const raw = Buffer.isBuffer(event.body) ? event.body : Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8');
    if (raw.length > 2048) return reply(413, { ok: false });
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    if (!input || Object.keys(input).sort().join(',') !== 'issuedAt,mac,nonce,rules' ||
        typeof input.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(input.nonce) ||
        !Number.isSafeInteger(input.issuedAt) || Math.abs(Date.now() - input.issuedAt) > 120_000 ||
        !Array.isArray(input.rules) || !input.rules.length || input.rules.length > 16 ||
        !input.rules.every(rule => typeof rule === 'string' && validRule(rule)) ||
        typeof input.mac !== 'string' || !/^[a-f0-9]{64}$/.test(input.mac)) return reply(400, { ok: false });
    const expected = signObservation({ nonce: input.nonce, issuedAt: input.issuedAt, rules: input.rules }, key);
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.mac, 'hex'))) return reply(403, { ok: false });
  } catch { return reply(400, { ok: false }); }
  try {
    if (!await observerDependencies.claim(event)) return reply(409, { ok: false, category: 'already_consumed' });
  } catch { return reply(503, { ok: false, category: 'gate_unavailable' }); }
  try {
    const before = await observerDependencies.observe();
    const driver = await observerDependencies.connect();
    const after = await observerDependencies.observe();
    const result = { ok: true, beforePermitted: matchesRules(before, input.rules), afterPermitted: matchesRules(after, input.rules),
      observationsConsistent: before === after, driver,
      limitation: 'https_egress_may_differ_from_mongodb_and_change' };
    // Only the fixed driver categories and booleans are retained in the response.
    console.info(JSON.stringify({ event: 'egress_observation', ...result }));
    return reply(200, result);
  } catch { return reply(503, { ok: false, category: 'observation_failed' }); }
}
