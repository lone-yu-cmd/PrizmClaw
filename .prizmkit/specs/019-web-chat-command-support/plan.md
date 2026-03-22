# Plan — F-019: Web Chat Command Support

## Key Components

1. **Web Command Router** (`src/routes/web-command-router.js`) — New service that wraps the Telegram command registry for web context
2. **API Route Extension** (`src/routes/api-routes.js`) — Detect `/` commands in POST /api/chat, route through web command router, return formatted result
3. **Commands List Endpoint** — GET /api/commands returns available commands for autocomplete
4. **Frontend Autocomplete** (`public/js/main.js`) — Dropdown on `/` keydown in textarea, command selection autocomplete

## Data Flow

```
Web chat input /cli list
  → POST /api/chat {message: '/cli list'}
  → api-routes.js: message.startsWith('/') → webCommandRouter.handle(message, sessionId)
  → webCommandRouter: parseCommand(message) → getCommand('cli') → call handler
  → handler returns string result
  → format as HTML-safe text → publish SSE + return in JSON reply
```

## Files to Create/Modify

- CREATE: `src/routes/web-command-router.js` — Web-adapted command dispatcher
- MODIFY: `src/routes/api-routes.js` — Add command detection to /api/chat + GET /api/commands
- MODIFY: `public/js/main.js` — Add command autocomplete UI
- CREATE: `tests/bot/commands/web-command-router.test.js` — Unit tests

## Architecture Notes

- Web command handler context differs from Telegram ctx: no ctx.reply, uses return value
- Security: web commands skip isAllowedUser (web has no userId) — always allow; permission check uses null userId
- Output format: plain text (not MarkdownV2), HTML-escape for safety, code blocks as <pre>
- /exec not a registered command — maps to executeSystemCommand service directly

## Tasks

- [x] T1: Create `src/routes/web-command-router.js` — parseCommand + dispatch to handler, return text result
- [x] T2: Add /exec support in web-command-router (calls executeSystemCommand directly, returns formatted output)
- [x] T3: Modify `src/routes/api-routes.js` — detect slash commands in /api/chat, add GET /api/commands endpoint
- [x] T4: Modify `public/js/main.js` — autocomplete dropdown on '/' keydown
- [x] T5: Write tests for web-command-router
