/**
 * Message Router Service
 *
 * Unified message processor for both Web and Telegram channels.
 * Routes messages through ai-cli-service and publishes events via realtime-hub.
 *
 * F-018: Web-Telegram Bidirectional Sync
 */

import { sanitizeInput } from '../security/guard.js';
import { logger } from '../utils/logger.js';
import { chatQueue } from './chat-queue.js';

/**
 * @typedef {Object} MessageProcessOptions
 * @property {string} channel - Channel name ('web' or 'telegram')
 * @property {string} sessionId - Session ID (web session ID or Telegram chat ID)
 * @property {string} message - User message
 * @property {string} [telegramChatId] - Bound Telegram chat ID (optional)
 * @property {string} [userId] - User ID who initiated the message
 * @property {Object} [hooks] - Callback hooks
 * @property {Function} [hooks.onStatus] - Status change callback (payload) => void
 * @property {Function} [hooks.onAssistantChunk] - Chunk callback (data) => void
 * @property {Function} [hooks.onAssistantDone] - Done callback (data) => void
 */

/**
 * Creates a message router instance
 * @param {Object} dependencies
 * @param {Function} dependencies.aiCliExecutor - AI CLI executor (executeAiCli function)
 * @param {Object} dependencies.sessionStore - Session store instance
 * @param {Object} dependencies.realtimeHub - Realtime hub instance
 * @returns {MessageRouter}
 */
export function createMessageRouter({ aiCliExecutor, sessionStore, realtimeHub }) {
  return {
    /**
     * Process a message from any channel
     * @param {MessageProcessOptions} options
     * @returns {Promise<{reply: string}>}
     */
    async processMessage(options) {
      const {
        channel,
        sessionId,
        message,
        telegramChatId,
        userId,
        hooks = {}
      } = options;

      // Validate required fields
      const normalizedChannel = String(channel ?? '').trim();
      const normalizedSessionId = String(sessionId ?? '').trim();
      const normalizedMessage = String(message ?? '').trim();

      if (!normalizedSessionId) {
        throw new Error('sessionId 不能为空。');
      }

      if (!normalizedMessage) {
        throw new Error('message 不能为空。');
      }

      // Determine session key based on binding
      let sessionKey;
      if (telegramChatId) {
        sessionKey = `telegram:${telegramChatId}`;
      } else {
        sessionKey = `${normalizedChannel}:${normalizedSessionId}`;
      }

      // Use chat queue to ensure sequential processing per session
      return chatQueue.run(sessionKey, async () => {
        const sanitized = sanitizeInput(normalizedMessage);

        // Publish accepted status
        hooks.onStatus?.({ stage: 'accepted', channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId });
        realtimeHub.publish(sessionKey, { type: 'status', payload: { stage: 'accepted', channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId } });

        // Append user message to session store
        sessionStore.append(sessionKey, 'user', sanitized);

        // Publish user message event for cross-channel sync
        realtimeHub.publish(sessionKey, { type: 'user_message', payload: { channel: normalizedChannel, sessionId: normalizedSessionId, message: sanitized, timestamp: Date.now() } });

        // Build prompt for AI CLI
        const prompt = sessionStore.toPrompt(sessionKey, normalizedChannel);

        // Publish running status
        hooks.onStatus?.({ stage: 'running', channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId });
        realtimeHub.publish(sessionKey, { type: 'status', payload: { stage: 'running', channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId } });

        logger.info({ sessionKey, channel: normalizedChannel, userId }, 'Processing message');

        // Execute via AI CLI service
        const result = await aiCliExecutor({
          sessionId: sessionKey,
          prompt,
          userId,
          hooks: {
            onChunk: (text) => {
              // Forward chunks to caller and realtime hub
              hooks.onAssistantChunk?.({ text, channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId });
              realtimeHub.publish(sessionKey, { type: 'assistant_chunk', payload: { text, channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId } });
            },
            onStatus: (status) => {
              logger.debug({ sessionKey, status }, 'AI CLI status changed');
            }
          }
        });

        // Append assistant reply to session store
        sessionStore.append(sessionKey, 'assistant', result.output);

        // Publish assistant done event
        const donePayload = { reply: result.output, channel: normalizedChannel, sessionId: normalizedSessionId, telegramChatId };
        hooks.onAssistantDone?.(donePayload);
        realtimeHub.publish(sessionKey, { type: 'assistant_done', payload: { ...donePayload, timestamp: Date.now() } });

        logger.info({ sessionKey, elapsedMs: result.elapsedMs }, 'Message processed');

        return { reply: result.output };
      });
    }
  };
}
