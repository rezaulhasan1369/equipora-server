export class DatabaseConfigurationError extends Error {
  constructor() {
    super('Database is not configured');
    this.name = 'DatabaseConfigurationError';
  }
}

export type DatabaseFailureCategory =
  | 'missing_configuration' | 'invalid_configuration' | 'dns'
  | 'authentication' | 'permission' | 'connection_timeout'
  | 'network' | 'tls' | 'unknown' | TransportFailureCategory;

export type TransportFailureCategory = 'connection_reset' | 'premature_close' |
  'handshake_timeout' | 'certificate_error' | 'tls_alert_internal' |
  'tls_alert_handshake_failure' | 'tls_alert_protocol_version' |
  'tls_alert_unknown_ca' | 'tls_alert_access_denied' | 'tls_alert' | 'unknown_network_error';

export function classifyTransportFailure(error: unknown): TransportFailureCategory {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'ECONNRESET') return 'connection_reset';
  if (code === 'EPIPE' || code === 'ERR_STREAM_PREMATURE_CLOSE') return 'premature_close';
  if (code === 'ETIMEDOUT' || code === 'ERR_TLS_HANDSHAKE_TIMEOUT') return 'handshake_timeout';
  const certificates = ['CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_REVOKED', 'CERT_SIGNATURE_FAILURE'];
  if (certificates.includes(String(code))) return 'certificate_error';
  const alerts: Record<string, TransportFailureCategory> = {
    ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR: 'tls_alert_internal',
    ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE: 'tls_alert_handshake_failure',
    'ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE': 'tls_alert_handshake_failure',
    ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION: 'tls_alert_protocol_version',
    ERR_SSL_TLSV1_ALERT_UNKNOWN_CA: 'tls_alert_unknown_ca',
    ERR_SSL_TLSV1_ALERT_ACCESS_DENIED: 'tls_alert_access_denied',
  };
  if (typeof code === 'string' && Object.hasOwn(alerts, code)) return alerts[code];
  if (typeof code === 'string' && /^ERR_SSL_[A-Z0-9_/]*ALERT_[A-Z0-9_]+$/.test(code)) return 'tls_alert';
  return 'unknown_network_error';
}

// Never return error messages, stacks, hostnames, URIs, or arbitrary driver fields.
// Selection errors wrap topology/server errors, so inspect their causes too.
export function classifyDatabaseFailure(error: unknown): DatabaseFailureCategory {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  const categories = new Set<DatabaseFailureCategory>();
  while (pending.length && seen.size < 32) {
    const item = pending.shift();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    const entry = item as {
      name?: unknown; code?: unknown; cause?: unknown; reason?: unknown;
      error?: unknown; servers?: unknown; errors?: unknown;
    };
    if (item instanceof DatabaseConfigurationError) categories.add('missing_configuration');
    if (entry.name === 'MongoParseError' || entry.name === 'MongoInvalidArgumentError') categories.add('invalid_configuration');
    if (entry.code === 18 || entry.code === 'AuthenticationFailed') categories.add('authentication');
    if (entry.code === 13 || entry.code === 'Unauthorized') categories.add('permission');
    if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL', 'ENODATA', 'ETIMEOUT'].includes(String(entry.code))) categories.add('dns');
    if (entry.name === 'MongoServerSelectionError' || entry.name === 'MongoNetworkTimeoutError' || entry.code === 'ETIMEDOUT') categories.add('connection_timeout');
    if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(String(entry.code))) categories.add('network');
    const transport = classifyTransportFailure(item);
    if (transport !== 'unknown_network_error' && transport !== 'handshake_timeout') categories.add(transport);
    if (transport === 'handshake_timeout') categories.add('connection_timeout');
    pending.push(entry.cause, entry.reason, entry.error);
    if (Array.isArray(entry.errors)) pending.push(...entry.errors.slice(0, 16));
    if (entry.servers instanceof Map) {
      for (const server of entry.servers.values()) {
        if (pending.length >= 64) break;
        pending.push(server);
      }
    }
  }
  // Prefer a specific cause over the outer server-selection timeout.
  const priority: DatabaseFailureCategory[] = [
    'missing_configuration', 'invalid_configuration', 'authentication',
    'permission', 'dns', 'certificate_error', 'tls_alert_internal', 'tls_alert_handshake_failure',
    'tls_alert_protocol_version', 'tls_alert_unknown_ca', 'tls_alert_access_denied', 'tls_alert',
    'connection_reset', 'premature_close', 'tls', 'network', 'connection_timeout',
  ];
  return priority.find(category => categories.has(category)) ?? 'unknown';
}
