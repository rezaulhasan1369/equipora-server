import 'dotenv/config';
import { createConfigProof } from '../src/db-network-diagnostics.js';

// Run only after the diagnostic deployment is explicitly approved and published.
// No URL/host arguments, secret CLI arguments, or on-disk fingerprint files.
const statuses = new Set(['ok', 'no_records', 'timeout', 'dns_error', 'network_error', 'certificate_error', 'skipped',
  'connection_reset', 'premature_close', 'handshake_timeout', 'tls_alert_internal', 'tls_alert_handshake_failure',
  'tls_alert_protocol_version', 'tls_alert_unknown_ca', 'tls_alert_access_denied', 'tls_alert', 'unknown_network_error']);
const driverCategories = new Set([...statuses, 'missing_configuration', 'invalid_configuration', 'authentication', 'permission', 'dns', 'connection_timeout', 'network', 'tls', 'unknown']);
const stages = new Set(['connected', 'after_mongodb_handshake', 'after_tls', 'tls', 'tcp', 'unobserved', 'skipped']);
const fixed = (value: unknown, allowed: Set<string>) => typeof value === 'string' && allowed.has(value) ? value : 'unknown';
const status = (value: unknown) => typeof value === 'string' && statuses.has(value) ? value : 'unknown';
const family = (value: { dns?: unknown; tcp?: unknown; tls?: unknown } | undefined) => ({
  dns: status(value?.dns), tcp: status(value?.tcp), tls: status(value?.tls),
});

try {
  const uri = process.env.MONGODB_URI;
  const key = process.env.DIAGNOSTIC_KEY;
  if (!uri || !key || process.argv.length !== 2) throw new Error('Configuration required');
  const response = await fetch('https://equipora-api.netlify.app/api/health/db/diagnostics', {
    // Covers the existing bounded network probes plus unchanged 5s driver selection.
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
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
      driver: {
        connected: body.driver?.connected === true,
        category: fixed(body.driver?.category, driverCategories),
        stage: fixed(body.driver?.stage, stages),
        tls: fixed(body.driver?.tls, new Set(['established', 'failed_before_secure', 'incomplete', 'not_observed'])),
        mongodbHandshake: fixed(body.driver?.mongodbHandshake, new Set(['completed', 'not_observed'])),
        failureStages: Array.isArray(body.driver?.failureStages) ? body.driver.failureStages.slice(0, 3).map((value: unknown) => fixed(value, stages)) : [],
        failureCategories: Array.isArray(body.driver?.failureCategories) ? body.driver.failureCategories.slice(0, 16).map((value: unknown) => fixed(value, statuses)) : [],
        truncated: body.driver?.truncated === true,
      },
    }));
  }
} catch {
  console.error('Diagnostic comparison could not complete; no connection details were printed.');
  process.exitCode = 1;
}
