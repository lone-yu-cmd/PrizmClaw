import { Router } from 'express';
import { buildSessionContext, resetSession } from '../services/chat-service.js';
import { captureScreenshot } from '../services/screenshot-service.js';
import { executeSystemCommand } from '../services/system-exec-service.js';
import { routeWebCommand, getAvailableCommands } from './web-command-router.js';

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createApiRouter({ realtimeHub, sessionBind, messageRouter, sessionStore }) {
  const router = Router();

  // F-018: Session binding endpoints
  router.post('/bind', async (req, res, next) => {
    try {
      await sessionBind.ensureReady();
      const { webSessionId, telegramChatId } = req.body ?? {};

      if (!webSessionId || !telegramChatId) {
        return res.status(400).json({ ok: false, error: 'webSessionId and telegramChatId are required' });
      }

      sessionBind.bindSession(webSessionId, telegramChatId);

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/unbind', async (req, res, next) => {
    try {
      await sessionBind.ensureReady();
      const { webSessionId } = req.body ?? {};

      if (!webSessionId) {
        return res.status(400).json({ ok: false, error: 'webSessionId is required' });
      }

      sessionBind.unbindSession(webSessionId);

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/bindings', async (req, res, next) => {
    try {
      await sessionBind.ensureReady();
      const { webSessionId } = req.query;

      if (webSessionId) {
        const telegramChatId = sessionBind.getBoundChatId(webSessionId);
        res.json({ ok: true, telegramChatId });
      } else {
        const allBindings = sessionBind.getAllBindings();
        res.json({ ok: true, bindings: allBindings });
      }
    } catch (error) {
      next(error);
    }
  });

  // SSE events endpoint - support Telegram-bound sessions
  router.get('/events', (req, res, next) => {
    try {
      const { channel = 'web', sessionId, telegramChatId } = req.query;

      let sessionKey;
      if (telegramChatId) {
        sessionKey = `telegram:${telegramChatId}`;
      } else {
        const session = buildSessionContext(channel, sessionId);
        sessionKey = session.sessionKey;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      writeSseEvent(res, 'connected', {
        ok: true,
        channel,
        sessionId,
        sessionKey
      });

      // F-018: Replay message history for offline clients (T4.2)
      const existingMessages = sessionStore.get(sessionKey);
      for (const msg of existingMessages) {
        writeSseEvent(res, msg.role === 'user' ? 'user_message' : 'assistant_message', {
          role: msg.role,
          content: msg.content,
          replay: true
        });
      }

      const unsubscribe = realtimeHub.subscribe(sessionKey, (event) => {
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

  // F-019: Commands list for web autocomplete
  router.get('/commands', (_req, res) => {
    const commands = getAvailableCommands();
    res.json({ ok: true, commands });
  });

  // F-018: Modified /api/chat to use message-router and support Telegram binding
  router.post('/chat', async (req, res, next) => {
    try {
      await sessionBind.ensureReady();
      const { channel = 'web', sessionId, message, telegramChatId } = req.body ?? {};

      // F-019: Detect and route slash commands for web channel
      if (channel === 'web' && typeof message === 'string' && message.trim().startsWith('/')) {
        const commandResult = await routeWebCommand(message.trim(), sessionId);
        if (commandResult !== null) {
          // Publish as assistant message via realtimeHub
          const session = buildSessionContext(channel, sessionId);
          const sessionKey = session.sessionKey;
          realtimeHub.publish(sessionKey, {
            type: 'assistant_done',
            payload: { reply: commandResult, isCommand: true }
          });
          return res.json({ ok: true, reply: commandResult, isCommand: true });
        }
      }

      let effectiveTelegramChatId = telegramChatId;

      // If no telegramChatId provided but session is bound, use the bound chat ID
      if (!effectiveTelegramChatId) {
        effectiveTelegramChatId = sessionBind.getBoundChatId(sessionId);
      }

      const result = await messageRouter.processMessage({
        channel,
        sessionId,
        message,
        telegramChatId: effectiveTelegramChatId,
        hooks: {
          onStatus: (payload) => {
            // Status events are already published by message-router
          },
          onAssistantChunk: (data) => {
            // Chunk events are already published by message-router
          },
          onAssistantDone: (data) => {
            // Done events are already published by message-router
          }
        }
      });

      res.json({ ok: true, reply: result.reply });
    } catch (error) {
      next(error);
    }
  });

  router.post('/chat/reset', async (req, res, next) => {
    try {
      await sessionBind.ensureReady();
      const { channel = 'web', sessionId, telegramChatId } = req.body ?? {};

      let sessionKey;
      let effectiveTelegramChatId;

      if (telegramChatId) {
        sessionKey = `telegram:${telegramChatId}`;
      } else if (channel === 'web' && sessionId) {
        effectiveTelegramChatId = sessionBind.getBoundChatId(sessionId);
        if (effectiveTelegramChatId) {
          sessionKey = `telegram:${effectiveTelegramChatId}`;
        } else {
          resetSession({ channel, sessionId });
          return res.json({ ok: true });
        }
      } else {
        resetSession({ channel, sessionId });
        return res.json({ ok: true });
      }

      sessionStore.clear(sessionKey);
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
