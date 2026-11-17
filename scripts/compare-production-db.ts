import 'dotenv/config';
import { createConfigProof } from '../src/db-network-diagnostics.js';

// Run only after the diagnostic deployment is explicitly approved and published.
// No URL/host arguments, secret CLI arguments, or on-disk fingerprint files.
const statuses = new Set(['ok', 'no_records', 'timeout', 'dns_error', 'network_error', 'certificate_error', 'skipped']);
const status = (value: unknown) => typeof value === 'string' && statuses.has(value) ? value : 'unknown';
const family = (value: { dns?: unknown; tcp?: unknown; tls?: unknown } | undefined) => ({
  dns: status(value?.dns), tcp: status(value?.tcp), tls: status(value?.tls),
});

try {
  const uri = process.env.MONGODB_URI;
  const key = process.env.DIAGNOSTIC_KEY;
  if (!uri || !key || process.argv.length !== 2) throw new Error('Configuration required');
  const response = await fetch('https://equipora-api.netlify.app/api/health/db/diagnostics', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/json', 'x-diagnostic-key': key },
    body: JSON.stringify({ expected: createConfigProof(uri, key) }),
  });
  if (!response.ok) {
    console.log(JSON.stringify({ status: response.status, ok: false }));
    process.exitCode = 1;
  } else {
    const body = await response.json();
    // Whitelist output even if the upstream response is unexpected.
    console.log(JSON.stringify({
      status: response.status, ok: body.ok === true,
      configuration: Object.fromEntries(['cluster', 'database', 'authentication', 'connectionOptions'].map(field =>
        [field, typeof body.configuration?.[field] === 'boolean' ? body.configuration[field] : null])),
      network: {
        supported: body.network?.supported === true,
        dns: { srv: status(body.network?.dns?.srv), txt: status(body.network?.dns?.txt) },
        targetsAccepted: body.network?.targetsAccepted === true,
        truncated: body.network?.truncated === true,
        servers: Array.isArray(body.network?.servers) ? body.network.servers.slice(0, 3).map((server: { ipv4?: Parameters<typeof family>[0]; ipv6?: Parameters<typeof family>[0] }) => ({ ipv4: family(server.ipv4), ipv6: family(server.ipv6) })) : [],
      },
    }));
  }
} catch {
  console.error('Diagnostic comparison could not complete; no connection details were printed.');
  process.exitCode = 1;
}
