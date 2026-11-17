import { createHmac, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Called by the private operator session with a freshly read Atlas snapshot.
// Never accepts a destination or prints/serializes inputs to disk or the console.
export async function runEgressObservation(rules) {
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  const key = process.env.DIAGNOSTIC_KEY;
  if (!key || !Array.isArray(rules) || !rules.length || rules.length > 16) throw new Error('operator_input_unavailable');
  const input = { nonce: randomBytes(32).toString('hex'), issuedAt: Date.now(), rules };
  const mac = createHmac('sha256', key).update('equipora-egress-d1:').update(JSON.stringify(input)).digest('hex');
  try {
    const response = await fetch('https://equipora-api.netlify.app/.netlify/functions/egress-observer', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-diagnostic-key': key },
      body: JSON.stringify({ ...input, mac }), redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    const allowed = new Set(['ok', 'tls_alert_internal', 'tls_alert_handshake_failure', 'tls_alert_protocol_version',
      'tls_alert_unknown_ca', 'tls_alert_access_denied', 'tls_alert', 'connection_reset', 'premature_close',
      'connection_timeout', 'handshake_timeout', 'certificate_error', 'unknown_network_error', 'network', 'tls',
      'authentication', 'permission', 'dns', 'unknown', 'missing_configuration', 'invalid_configuration']);
    const stages = new Set(['connected', 'tls', 'tcp', 'after_tls', 'after_mongodb_handshake', 'unobserved']);
    return { status: response.status, ok: body.ok === true,
      category: ['already_consumed', 'gate_unavailable', 'observation_failed'].includes(body.category) ? body.category : undefined,
      beforePermitted: typeof body.beforePermitted === 'boolean' ? body.beforePermitted : null,
      afterPermitted: typeof body.afterPermitted === 'boolean' ? body.afterPermitted : null,
      observationsConsistent: typeof body.observationsConsistent === 'boolean' ? body.observationsConsistent : null,
      driver: body.driver ? { connected: body.driver.connected === true,
        category: allowed.has(body.driver.category) ? body.driver.category : 'unknown',
        stage: stages.has(body.driver.stage) ? body.driver.stage : 'unobserved',
        tls: ['established', 'failed_before_secure', 'incomplete', 'not_observed'].includes(body.driver.tls) ? body.driver.tls : 'not_observed',
        mongodbHandshake: body.driver.mongodbHandshake === 'completed' ? 'completed' : 'not_observed',
        truncated: body.driver.truncated === true } : undefined };
  } catch { return { ok: false, category: 'operator_request_failed' }; }
}
