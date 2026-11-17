import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyDatabaseFailure, DatabaseConfigurationError } from '../src/db-diagnostics.js';

test('classifies specific nested causes without returning raw error content', () => {
  const cases = [
    [new DatabaseConfigurationError(), 'missing_configuration'],
    [{ name: 'MongoParseError' }, 'invalid_configuration'],
    [{ code: 18 }, 'authentication'],
    [{ code: 13 }, 'permission'],
    [{ code: 'ENOTFOUND' }, 'dns'],
    [{ code: 'ETIMEOUT' }, 'dns'],
    [{ code: 'ETIMEDOUT' }, 'connection_timeout'],
    [{ name: 'MongoServerSelectionError' }, 'connection_timeout'],
    [{ code: 'ECONNREFUSED' }, 'network'],
    [{ code: 'CERT_HAS_EXPIRED' }, 'tls'],
    [{ message: 'secret-canary', name: 'secret-canary', code: 'secret-canary' }, 'unknown'],
    [null, 'unknown'],
  ] as const;
  for (const [error, expected] of cases) assert.equal(classifyDatabaseFailure(error), expected);
  const nested = {
    name: 'MongoServerSelectionError',
    reason: { servers: new Map([['private-host', { error: { cause: { code: 'ENOTFOUND', message: 'secret-canary' } } }]]) },
  };
  assert.equal(classifyDatabaseFailure(nested), 'dns');
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(classifyDatabaseFailure(cyclic), 'unknown');
});
