import express from 'express';
import cors from 'cors';
import { getClient } from './db.js';

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
  try {
    const client = await getClient();
    await client.db('equipora').command({ ping: 1 });
    res.json({ ok: true, database: 'reachable' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
