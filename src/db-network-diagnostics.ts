import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { BlockList, createConnection, isIP } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { MongoClient } from 'mongodb';
import { DatabaseConfigurationError, classifyTransportFailure } from './db-diagnostics.js';
import type { TransportFailureCategory } from './db-diagnostics.js';

const fields = ['cluster', 'database', 'authentication', 'connectionOptions'] as const;
export type ConfigProof = Record<typeof fields[number], string>;
export type ProbeStatus = 'ok' | 'no_records' | 'timeout' | 'dns_error' | 'network_error' | 'skipped' | TransportFailureCategory;
type Target = { name: string; port: number };
type FamilyResult = { dns: ProbeStatus; tcp: ProbeStatus; tls: ProbeStatus };
const STEP_MS = 1200;
export const NETWORK_DIAGNOSTIC_BUDGET_MS = 6000;

// These keyed proofs are sent in an authenticated POST body, never returned/logged.
// Never derive proofs from passwords, complete URIs, or mechanism properties.
// Otherwise an authenticated caller could use equality results to test secrets.
export function createConfigProof(uri: string, key: string): ConfigProof {
  const options = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 }).options;
  const values = {
    cluster: { srvHost: options.srvHost, hosts: options.hosts.map(host => host.toString()).sort() },
    database: { configured: options.dbName, application: 'equipora' },
    authentication: {
      dedicatedUser: options.credentials?.username === 'equipora_app',
      source: options.credentials?.source, mechanism: options.credentials?.mechanism,
    },
    connectionOptions: {
      tls: options.tls, rejectUnauthorized: options.rejectUnauthorized !== false,
      customHostnameCheck: Boolean(options.checkServerIdentity),
      customCa: Boolean(options.tlsCAFile), clientCertificate: Boolean(options.tlsCertificateKeyFile),
      family: options.family, autoSelectFamily: options.autoSelectFamily,
      replicaSet: options.replicaSet, directConnection: options.directConnection,
      loadBalanced: options.loadBalanced, proxy: Boolean(options.proxyHost),
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS,
      connectTimeoutMS: options.connectTimeoutMS, socketTimeoutMS: options.socketTimeoutMS,
    },
  };
  return Object.fromEntries(fields.map(field => [field,
    createHmac('sha256', key).update(`equipora-d06:${field}:`).update(JSON.stringify(values[field])).digest('hex'),
  ])) as ConfigProof;
}

const forbiddenAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) forbiddenAddresses.addSubnet(address, prefix, 'ipv4');
forbiddenAddresses.addSubnet('2001:db8::', 32, 'ipv6');

export function isPublicProbeAddress(address: string, family: 4 | 6): boolean {
  if (isIP(address) !== family || address.includes('%')) return false;
  if (family === 4) return !forbiddenAddresses.check(address, 'ipv4');
  // Only global unicast; exclude mapped IPv4, loopback, local, link-local,
  // multicast, documentation, transition and special-purpose IPv6 ranges.
  return /^[23]/i.test(address) && !/^(?:2001:|2002:)/i.test(address) &&
    !forbiddenAddresses.check(address, 'ipv6');
}

export function validConfigProof(value: unknown): value is ConfigProof {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === fields.length && fields.every(field =>
    typeof record[field] === 'string' && /^[a-f0-9]{64}$/.test(record[field]));
}

export function compareConfigProof(actual: ConfigProof, expected: ConfigProof): Record<typeof fields[number], boolean> {
  return Object.fromEntries(fields.map(field => [field,
    timingSafeEqual(Buffer.from(actual[field], 'hex'), Buffer.from(expected[field], 'hex')),
  ])) as Record<typeof fields[number], boolean>;
}

function dnsStatus(error: unknown): ProbeStatus {
  const code = (error as { code?: unknown })?.code;
  if (code === 'ENODATA' || code === 'ENOTFOUND') return 'no_records';
  if (code === 'ETIMEOUT' || code === 'ECANCELLED') return 'timeout';
  return 'dns_error';
}

async function resolveDns<T>(lookup: (resolver: Resolver) => Promise<T>, signal: AbortSignal): Promise<T> {
  const resolver = new Resolver({ timeout: STEP_MS, tries: 1 });
  if (signal.aborted) throw { code: 'ECANCELLED' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => resolver.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    // cancel() stops outstanding resolver work; race also bounds empty/no-op resolvers.
    return await Promise.race([lookup(resolver), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { resolver.cancel(); reject({ code: 'ETIMEOUT' }); }, STEP_MS);
    })]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

// The HTTP route never accepts targets. This helper receives only validated SRV targets.
export function probeTransport(target: Target, address: string, family: 4 | 6, signal: AbortSignal): Promise<Pick<FamilyResult, 'tcp' | 'tls'>> {
  return new Promise(resolve => {
    let tcp: ProbeStatus = 'skipped';
    let done = false;
    let socket: ReturnType<typeof createConnection> | undefined;
    let secure: ReturnType<typeof connectTls> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (tls: ProbeStatus) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      secure?.destroy();
      socket?.destroy();
      resolve({ tcp, tls });
    };
    const abort = () => { if (tcp !== 'ok') tcp = 'timeout'; finish(tcp === 'ok' ? 'handshake_timeout' : 'skipped'); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    try {
      socket = createConnection({ host: address, port: target.port, family });
      timer = setTimeout(abort, STEP_MS);
      socket.once('error', error => { if (tcp !== 'ok') tcp = 'network_error'; finish(tcp === 'ok' ? classifyTransportFailure(error) : 'skipped'); });
      socket.once('end', () => { if (!done) finish(tcp === 'ok' ? 'premature_close' : 'skipped'); });
      socket.once('close', () => { if (!done) finish(tcp === 'ok' ? 'premature_close' : 'skipped'); });
      socket.once('connect', () => {
        if (done) return;
        tcp = 'ok';
        clearTimeout(timer);
        timer = setTimeout(abort, STEP_MS);
        try {
          secure = connectTls({ socket, servername: target.name, rejectUnauthorized: true });
          secure.once('secureConnect', () => finish('ok'));
          secure.once('error', error => finish(classifyTransportFailure(error)));
          secure.once('end', () => finish('premature_close'));
          secure.once('close', () => finish('premature_close'));
        } catch (error) { finish(classifyTransportFailure(error)); }
      });
    } catch { tcp = 'network_error'; finish('skipped'); }
  });
}

export const networkDependencies = {
  srv: (name: string, signal: AbortSignal) => resolveDns(resolver => resolver.resolveSrv(name), signal),
  txt: (name: string, signal: AbortSignal) => resolveDns(resolver => resolver.resolveTxt(name), signal),
  addresses: (name: string, family: 4 | 6, signal: AbortSignal) => resolveDns(resolver => family === 4 ? resolver.resolve4(name) : resolver.resolve6(name), signal),
  transport: probeTransport,
};

export async function runNetworkDiagnostics(uri: string, dependencies = networkDependencies) {
  if (!uri) throw new DatabaseConfigurationError();
  const options = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 }).options;
  const host = options.srvHost?.toLowerCase();
  // This probe is deliberately limited to the existing Atlas SRV architecture.
  // Refuse proxies, non-Atlas targets, altered SRV services, and insecure TLS.
  if (!host || !/^[a-z0-9-]+\.[a-z0-9-]+\.mongodb\.net$/.test(host) || options.proxyHost ||
      options.srvServiceName !== 'mongodb' || !options.tls || options.tlsInsecure ||
      options.rejectUnauthorized === false || options.checkServerIdentity ||
      options.tlsCAFile || options.tlsCertificateKeyFile) {
    return { supported: false as const };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_DIAGNOSTIC_BUDGET_MS);
  try {
    const signal = controller.signal;
    const [srv, txt] = await Promise.allSettled([
      dependencies.srv(`_mongodb._tcp.${host}`, signal), dependencies.txt(host, signal),
    ]);
    const dns = { srv: srv.status === 'fulfilled' ? 'ok' : dnsStatus(srv.reason), txt: txt.status === 'fulfilled' ? 'ok' : dnsStatus(txt.reason) };
    if (srv.status !== 'fulfilled') return { supported: true as const, dns, servers: [] };
    const suffix = host.slice(host.indexOf('.'));
    const records = srv.value;
    if (!records.length || records.some(record => record.port !== 27017 ||
        !record.name.toLowerCase().endsWith(suffix) || !/^[a-z0-9.-]+$/i.test(record.name))) {
      return { supported: true as const, dns, targetsAccepted: false, servers: [] };
    }
    const targets = [...new Map(records.map(record => [`${record.name}:${record.port}`, record])).values()]
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
    const servers = await Promise.all(targets.map(async target => {
      const family = async (version: 4 | 6): Promise<FamilyResult> => {
        try {
          const addresses = await dependencies.addresses(target.name, version, signal);
          if (!addresses.length) return { dns: 'no_records', tcp: 'skipped', tls: 'skipped' };
          if (addresses.some(address => !isPublicProbeAddress(address, version))) {
            return { dns: 'dns_error', tcp: 'skipped', tls: 'skipped' };
          }
          return { dns: 'ok', ...await dependencies.transport(target, addresses[0], version, signal) };
        } catch (error) { return { dns: dnsStatus(error), tcp: 'skipped', tls: 'skipped' }; }
      };
      const [ipv4, ipv6] = await Promise.all([family(4), family(6)]);
      return { ipv4, ipv6 };
    }));
    return { supported: true as const, dns, targetsAccepted: true, truncated: records.length > targets.length, servers };
  } finally { clearTimeout(timer); }
}
