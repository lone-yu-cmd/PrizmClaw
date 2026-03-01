import express from 'express';
import { createApiRouter } from '../routes/api-routes.js';
import { realtimeHub } from '../services/realtime-hub.js';

export function createHttpServer({ logger }) {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', createApiRouter({ realtimeHub }));
  app.use(express.static('public'));

  app.use((error, _req, res, _next) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message }, 'HTTP request failed');
    res.status(400).json({ ok: false, error: message });
  });

  return app;
}
