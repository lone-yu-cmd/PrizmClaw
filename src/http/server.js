import express from 'express';
import { config } from '../config.js';
import { createApiRouter } from '../routes/api-routes.js';
import { realtimeHub } from '../services/realtime-hub.js';
import { sessionStore } from '../services/session-store.js';
import { createSessionBindService } from '../services/session-bind.js';
import { createMessageRouter } from '../services/message-router.js';
import { executeAiCli } from '../services/ai-cli-service.js';

export function createHttpServer({ logger, sessionBindingsPath } = {}) {
  const app = express();

  // Initialize F-018 services
  const effectiveBindingsPath = sessionBindingsPath || config.sessionBindingsPath;
  const sessionBind = createSessionBindService({ bindingsPath: effectiveBindingsPath });
  const messageRouter = createMessageRouter({
    aiCliExecutor: executeAiCli,
    sessionStore,
    realtimeHub
  });

  app.use(express.json({ limit: '2mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', createApiRouter({ realtimeHub, sessionBind, messageRouter, sessionStore }));
  app.use(express.static('public'));

  app.use((error, _req, res, _next) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message }, 'HTTP request failed');
    res.status(400).json({ ok: false, error: message });
  });

  return app;
}
