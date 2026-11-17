import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { getClient } from './db.js';
import { classifyDatabaseFailure } from './db-diagnostics.js';
import { compareConfigProof, createConfigProof, runNetworkDiagnostics, validConfigProof } from './db-network-diagnostics.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cors({ origin: (origin, callback) => {
  const allowed = process.env.CORS_ORIGIN;
  if (!origin || (allowed && origin === allowed)) return callback(null, true);
  return callback(new Error('Origin not allowed'));
}}));

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'equipora-api', timestamp: new Date().toISOString() });
});

app.get('/api/health/db', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const key = process.env.DIAGNOSTIC_KEY;
  if (!key || req.get('x-diagnostic-key') !== key) {
    res.status(404).json({ ok: false });
    return;
  }
  let stage: 'connect' | 'ping' = 'connect';
  try {
    const client = await getClient();
    stage = 'ping';
    await client.db('equipora').command({ ping: 1 });
    res.json({ ok: true, database: 'reachable' });
  } catch (error: unknown) {
    console.error(JSON.stringify({
      event: 'database_health_failure',
      stage,
      category: classifyDatabaseFailure(error),
    }));
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

let diagnosticRunning = false;
let lastDiagnosticStart = -Infinity;
app.post('/api/health/db/diagnostics', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const key = process.env.DIAGNOSTIC_KEY;
  if (!key || req.get('x-diagnostic-key') !== key) {
    res.status(404).json({ ok: false });
    return;
  }
  // Fingerprints are the only input; no caller-supplied URI, host, IP, or port.
  if (Object.keys(req.query).length || !req.body || Object.keys(req.body).length !== 1 ||
      !validConfigProof(req.body.expected)) {
    res.status(400).json({ ok: false });
    return;
  }
  if (diagnosticRunning || Date.now() - lastDiagnosticStart < 30_000) {
    res.status(429).json({ ok: false });
    return;
  }
  diagnosticRunning = true;
  lastDiagnosticStart = Date.now();
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      res.status(503).json({ ok: false, category: 'missing_configuration' });
      return;
    }
    const configuration = compareConfigProof(createConfigProof(uri, key), req.body.expected);
    const network = await runNetworkDiagnostics(uri);
    res.json({ ok: true, configuration, network });
  } catch (error: unknown) {
    res.status(503).json({ ok: false, category: classifyDatabaseFailure(error) });
  } finally { diagnosticRunning = false; }
});

// Also sanitize parser/CORS errors that occur before the protected route runs.
const diagnosticInputError: ErrorRequestHandler = (_error, req, res, _next) => {
  res.set('Cache-Control', 'no-store');
  const key = process.env.DIAGNOSTIC_KEY;
  res.status(!key || req.get('x-diagnostic-key') !== key ? 404 : 400).json({ ok: false });
};
app.use('/api/health/db/diagnostics', diagnosticInputError);

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
