import { runCodeBuddy } from '../adapters/codebuddy.js';
import { sanitizeInput } from '../security/guard.js';
import { chatQueue } from './chat-queue.js';
import { sessionStore } from './session-store.js';

export function buildSessionContext(channel, sessionId) {
  const normalizedChannel = String(channel ?? '').trim();
  const normalizedSessionId = String(sessionId ?? '').trim();

  if (!normalizedChannel) {
    throw new Error('channel 不能为空。');
  }

  if (!normalizedSessionId) {
    throw new Error('sessionId 不能为空。');
  }

  return {
    channel: normalizedChannel,
    sessionId: normalizedSessionId,
    sessionKey: `${normalizedChannel}:${normalizedSessionId}`
  };
}

export async function chatWithSession({ channel, sessionId, message, realtimeHooks = {} }) {
  const session = buildSessionContext(channel, sessionId);

  return chatQueue.run(session.sessionKey, async () => {
    const sanitized = sanitizeInput(message);

    realtimeHooks.onStatus?.({
      stage: 'accepted',
      channel: session.channel,
      sessionId: session.sessionId
    });

    sessionStore.append(session.sessionKey, 'user', sanitized);

    const prompt = sessionStore.toPrompt(session.sessionKey, session.channel);

    realtimeHooks.onStatus?.({
      stage: 'running',
      channel: session.channel,
      sessionId: session.sessionId
    });

    const reply = await runCodeBuddy(prompt, {
      onStdoutChunk: (text) => {
        realtimeHooks.onAssistantChunk?.({
          text,
          channel: session.channel,
          sessionId: session.sessionId
        });
      }
    });

    sessionStore.append(session.sessionKey, 'assistant', reply);

    realtimeHooks.onAssistantDone?.({
      reply,
      channel: session.channel,
      sessionId: session.sessionId
    });

    return reply;
  });
}

export function resetSession({ channel, sessionId }) {
  const session = buildSessionContext(channel, sessionId);
  sessionStore.clear(session.sessionKey);
}
