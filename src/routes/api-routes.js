import { Router } from 'express';
import { buildSessionContext, chatWithSession, resetSession } from '../services/chat-service.js';
import { captureScreenshot } from '../services/screenshot-service.js';
import { executeSystemCommand } from '../services/system-exec-service.js';

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createApiRouter({ realtimeHub }) {
  const router = Router();

  router.get('/events', (req, res, next) => {
    try {
      const { channel = 'web', sessionId } = req.query;
      const session = buildSessionContext(channel, sessionId);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      writeSseEvent(res, 'connected', {
        ok: true,
        channel: session.channel,
        sessionId: session.sessionId
      });

      const unsubscribe = realtimeHub.subscribe(session.sessionKey, (event) => {
        writeSseEvent(res, event.type, event.payload);
      });

      const heartbeat = setInterval(() => {
        res.write(': ping\n\n');
      }, 20000);

      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/chat', async (req, res, next) => {
    try {
      const { channel = 'web', sessionId, message } = req.body ?? {};
      const session = buildSessionContext(channel, sessionId);

      const reply = await chatWithSession({
        channel,
        sessionId,
        message,
        realtimeHooks: {
          onStatus: (payload) => {
            realtimeHub.publish(session.sessionKey, { type: 'status', payload });
          },
          onAssistantChunk: (payload) => {
            realtimeHub.publish(session.sessionKey, { type: 'assistant_chunk', payload });
          },
          onAssistantDone: (payload) => {
            realtimeHub.publish(session.sessionKey, { type: 'assistant_done', payload });
          }
        }
      });

      res.json({ ok: true, reply });
    } catch (error) {
      next(error);
    }
  });

  router.post('/chat/reset', async (req, res, next) => {
    try {
      const { channel = 'web', sessionId } = req.body ?? {};
      resetSession({ channel, sessionId });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/screenshot', async (_req, res, next) => {
    try {
      const { mimeType, imageBase64 } = await captureScreenshot();
      res.json({ ok: true, mimeType, imageBase64 });
    } catch (error) {
      next(error);
    }
  });

  router.post('/system/exec', async (req, res, next) => {
    try {
      const { command } = req.body ?? {};
      const result = await executeSystemCommand(command);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
