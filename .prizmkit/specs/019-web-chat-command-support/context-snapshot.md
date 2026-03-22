# Context Snapshot — F-019: Web Chat Command Support

## Section 1 — Feature Brief

**Description**: Web 页面聊天框支持与 Telegram 相同的斜杠命令（/exec、/cli、/config 等）。用户在 Web 聊天输入框中输入 / 前缀命令时，走与 Telegram 相同的命令路由逻辑，命令执行结果实时展示在 Web 聊天区域。

**Acceptance Criteria**:
- AC1: Web 聊天框输入 /exec <cmd> 可执行系统命令并在聊天区显示结果
- AC2: Web 聊天框输入 /cli、/config 等命令均可正常执行
- AC3: 命令输出格式适配 Web 展示，代码块和格式化内容正确渲染
- AC4: 输入 / 时展示可用命令列表作为自动补全提示
- AC5: 命令执行过程中显示加载状态，长输出支持分段展示

## Section 2 — Project Structure

```
src/
  routes/
    api-routes.js          ← HTTP API routes (200 lines), includes /api/chat endpoint
  bot/
    telegram.js            ← Telegram bot setup, registers all commands (~1013 lines)
    commands/
      index.js             ← routeCommand(), createCommandMiddleware(), registerCommand()
      registry.js          ← Command store, getAllCommands(), getCommand(), getAliasMap()
      parser.js            ← parseCommand() - parses /cmd subcommand args
      formatter.js         ← formatError(), ErrorCodes
      validator.js         ← validateCommand()
      intent-router.js     ← routeIntent(), enhanceSlashCommand()
      help.js              ← Help text generation
      handlers/
        cli.js, config.js, pipeline.js, status.js, logs.js, stop.js, plan.js,
        audit.js, commit.js, commits.js, cd.js, more.js, ls.js, tree.js, cat.js,
        head.js, tail.js, find.js, upload.js, download.js, sysinfo.js, ps.js,
        kill.js, monitor.js, history.js, alias.js, sessions.js, cron.js, jobs.js,
        watch.js, bugfix.js, planner.js
  services/
    message-router.js      ← processMessage({channel, sessionId, message, telegramChatId, hooks})
    session-bind.js        ← Session binding (web ↔ telegram)
    session-store.js       ← Session state storage
    realtime-hub.js        ← SSE event publishing/subscribing
    system-exec-service.js ← executeSystemCommand(command)
  security/
    guard.js               ← isAllowedUser(userId)
    permission-guard.js    ← checkCommandPermission(userId, commandName)

public/
  index.html               ← Web UI with chat panel, screenshot, exec panels
  styles.css
  js/
    main.js                ← Frontend JS (336 lines) - SSE, chat form, exec form
```

## Section 3 — Prizm Context

root.prizm KEY RULES:
- All HTTP routes use src/routes/api-routes.js as entry point
- Telegram bot uses Telegraf framework with command handlers in src/bot/commands/
- MUST use messageRouter.processMessage() for all chat messages
- MUST call sessionBind.ensureReady() before any sync method in async route handlers

routes.prizm: POST /api/chat → messageRouter.processMessage(); /api/events → SSE stream

bot.prizm TRAPS:
- Telegram text handler uses messageRouter.processMessage() — no longer calls executeAiCli directly
- Cross-channel push only subscribes for bindings at bot startup

## Section 4 — Existing Source Files

### src/routes/api-routes.js (205 lines)
```js
import { Router } from 'express';
import { buildSessionContext, resetSession } from '../services/chat-service.js';
import { captureScreenshot } from '../services/screenshot-service.js';
import { executeSystemCommand } from '../services/system-exec-service.js';

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createApiRouter({ realtimeHub, sessionBind, messageRouter, sessionStore }) {
  const router = Router();

  // ... bind/unbind/bindings/events endpoints ...

  // POST /api/chat - uses messageRouter.processMessage()
  router.post('/chat', async (req, res, next) => {
    try {
      await sessionBind.ensureReady();
      const { channel = 'web', sessionId, message, telegramChatId } = req.body ?? {};
      let effectiveTelegramChatId = telegramChatId;
      if (!effectiveTelegramChatId) {
        effectiveTelegramChatId = sessionBind.getBoundChatId(sessionId);
      }
      const result = await messageRouter.processMessage({
        channel, sessionId, message, telegramChatId: effectiveTelegramChatId,
        hooks: { onStatus: (p) => {}, onAssistantChunk: (d) => {}, onAssistantDone: (d) => {} }
      });
      res.json({ ok: true, reply: result.reply });
    } catch (error) { next(error); }
  });

  // POST /api/system/exec - executeSystemCommand(command)
  router.post('/system/exec', async (req, res, next) => {
    try {
      const { command } = req.body ?? {};
      const result = await executeSystemCommand(command);
      res.json({ ok: true, ...result });
    } catch (error) { next(error); }
  });

  return router;
}
```

### src/bot/commands/registry.js (220 lines)
Key exports:
- `getAllCommands()` → Array of {meta, handler}
- `getCommand(name)` → {meta, handler} or null
- `getAliasMap()` → {alias: commandName}
- `registerCommand(meta, handler)`
- CommandMeta has: name, aliases, description, usage, subcommands, params, helpText

### src/bot/commands/parser.js (94 lines)
```js
export function parseCommand(text, aliasMap = {}) {
  // Returns: { command, subcommand, args, options, raw }
  // or null if not a / command
}
```

### src/bot/commands/index.js (key exports)
```js
export async function routeCommand(ctx) // Telegram-specific, uses ctx.message, ctx.from, ctx.reply
export { registerCommand, getCommand, getAliasMap }
```

### public/js/main.js (336 lines)
Key state and elements:
- chatForm submit → POST /api/chat with {channel:'web', sessionId, message}
- SSE events: connected, status, assistant_chunk, assistant_done
- appendMessage(role, text) — renders text as textContent (no HTML rendering)
- setBusy(busy, text) — disables buttons, updates status
- chatInput = textarea#chatInput
- chatMessages = div#chatMessages
- state.busy, state.streamingMessageBody, state.streamedText

## Section 5 — Existing Tests

Test directories:
- tests/bot/commands/ — parser.test.js, registry.test.js, formatter.test.js, validator.test.js
- tests/integration/ — integration test files
- No existing tests for api-routes.js web command handling
