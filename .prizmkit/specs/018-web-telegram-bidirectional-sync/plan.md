# F-018: Web-Telegram Bidirectional Sync — Implementation Plan

## Architecture Overview

### Current State
- Web: HTTP API → `chat-service.js` → `codebuddy.js` adapter → spawns CLI process
- Telegram: Bot text handler → `executeAiCli()` directly → spawns CLI process
- Two completely isolated execution paths, no shared session state between channels

### Target State
- Both channels → `message-router.js` → `executeAiCli()` → spawns CLI process
- Shared session store keyed by `telegram:{chatId}` when bound
- `realtimeHub` publishes all events (user_message, assistant_chunk, assistant_done)
- Web SSE subscribers receive Telegram events; Telegram receives Web events via bot push
- `session-bind.js` provides `createSessionBindService()` factory for HTTP server

### Key Design Decisions
- D1: Keep `chat-service.js` and `codebuddy.js` as-is for backward compatibility but stop using them for the main chat flow. The Telegram bot text handler and Web chat endpoint both use `message-router.js`.
- D2: Session key strategy — when a web session is bound to a Telegram chat, both use `telegram:{chatId}` as session key. Unbound web sessions use `web:{sessionId}`.
- D3: Telegram bot subscribes to realtimeHub for the current chat's session key to push Web-originated messages to Telegram.
- D4: `createSessionBindService()` is a thin factory that creates + initializes a `SessionBindingService` instance, matching the import pattern in `server.js`.

### Data Flow

```
Web POST /api/chat
  → api-routes.js → messageRouter.processMessage()
  → sessionStore.append(sessionKey, 'user', msg)
  → realtimeHub.publish(sessionKey, user_message)
  → executeAiCli(sessionKey, prompt)
    → onChunk: realtimeHub.publish(sessionKey, assistant_chunk)
  → sessionStore.append(sessionKey, 'assistant', reply)
  → realtimeHub.publish(sessionKey, assistant_done)

Telegram text message
  → telegram.js text handler → messageRouter.processMessage()
  → Same flow as above (shared sessionKey + realtimeHub)

Web SSE /api/events?telegramChatId=X
  → Subscribe to realtimeHub(telegram:X)
  → Receives all events from both channels

Telegram bot subscription
  → On bot start, subscribe to realtimeHub for active chat sessions
  → When web-originated assistant_done arrives, push reply to Telegram chat
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/services/session-bind.js` | Modify | Add `createSessionBindService()` factory function |
| `src/services/index.js` | Modify | Update export to use new factory |
| `src/bot/telegram.js` | Modify | Replace direct executeAiCli + chatWithSession with message-router; add cross-channel push |
| `src/http/server.js` | Verify | Already correct, just needs working import |
| `src/routes/api-routes.js` | Verify | Already correct |
| `src/services/message-router.js` | Verify | Already correct |

### Testing Approach

- Unit tests: `session-bind-f018.test.js` (exists), `message-router.test.js` (exists)
- Integration test: `f018-web-telegram-sync.integration.test.js` (exists but may fail due to broken import)
- New test: Telegram bot message-router integration test
- Test command: `node --test tests/services/session-bind-f018.test.js tests/services/message-router.test.js tests/integration/f018-web-telegram-sync.integration.test.js`

## Tasks

- [x] T1: Add `createSessionBindService()` factory to `session-bind.js` — creates and auto-initializes a `SessionBindingService` instance with `bindingsPath` config. Update `index.js` export.
- [x] T2: Integrate `message-router` into Telegram bot text handler — replace direct `executeAiCli` + `sessionStore` calls with `messageRouter.processMessage()`. The message-router already handles session store append, prompt building, and realtimeHub publishing.
- [x] T3: Add cross-channel Telegram push — when a Web-originated message produces an AI reply, push the reply to the bound Telegram chat via `bot.telegram.sendMessage()`. Subscribe to realtimeHub events for bound sessions.
- [x] T4: Verify and fix existing tests — run all F-018 tests, fix any failures caused by the broken `createSessionBindService` import or message-router integration changes.
- [x] T5: Run full test suite — ensure no regressions across the project.
