export class DatabaseConfigurationError extends Error {
  constructor() {
    super('Database is not configured');
    this.name = 'DatabaseConfigurationError';
  }
}

export type DatabaseFailureCategory =
  | 'missing_configuration' | 'invalid_configuration' | 'dns'
  | 'authentication' | 'permission' | 'connection_timeout'
  | 'network' | 'tls' | 'unknown';

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
      error?: unknown; servers?: unknown;
    };
    if (item instanceof DatabaseConfigurationError) categories.add('missing_configuration');
    if (entry.name === 'MongoParseError' || entry.name === 'MongoInvalidArgumentError') categories.add('invalid_configuration');
    if (entry.code === 18 || entry.code === 'AuthenticationFailed') categories.add('authentication');
    if (entry.code === 13 || entry.code === 'Unauthorized') categories.add('permission');
    if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL', 'ENODATA', 'ETIMEOUT'].includes(String(entry.code))) categories.add('dns');
    if (entry.name === 'MongoServerSelectionError' || entry.name === 'MongoNetworkTimeoutError' || entry.code === 'ETIMEDOUT') categories.add('connection_timeout');
    if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(String(entry.code))) categories.add('network');
    if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(String(entry.code))) categories.add('tls');
    pending.push(entry.cause, entry.reason, entry.error);
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
    'permission', 'dns', 'tls', 'network', 'connection_timeout',
  ];
  return priority.find(category => categories.has(category)) ?? 'unknown';
}
