# Bug Fix Plan: Startup Crash on npm run dev

## Bug ID
`startup-crash`

## Diagnosis

### Root Causes

**1. Missing `await` in async bot initialization (src/index.js:24)**
- **Location**: `src/index.js:21-30`
- **Issue**: `createTelegramBot()` returns a Promise, but it was being assigned directly to `bot` without `await`
- **Result**: `bot.launch()` tried to call `.launch()` on a Promise object, throwing `TypeError: bot.launch is not a function`
- **Severity**: Critical - prevents startup

**2. Incorrect parameter name in alias store initialization (src/bot/telegram.js:510)**
- **Location**: `src/bot/telegram.js:510`
- **Issue**: Passed `{ filePath: ... }` instead of `{ persistencePath: ... }` to `aliasStore.initAliasStore()`
- **Result**: Alias store received `undefined` as the persistence path, failing to load aliases
- **Severity**: Critical - prevents Telegram bot initialization
- **Evidence**: Error message `"The path argument must be of type string or an instance of Buffer or URL. Received undefined"`

**3. Duplicate command alias "p" (src/bot/commands/handlers/plan.js & pipeline.js)**
- **Location**: `src/bot/commands/handlers/plan.js:60` and `src/bot/commands/handlers/pipeline.js:34`
- **Issue**: Both `plan` and `pipeline` commands registered with alias `'p'`
- **Result**: On second or subsequent bot initialization, registration fails with `Error: Alias "p" is already registered`
- **Severity**: High - prevents bot from recovering from errors; blocks dev mode hot reloads
- **Fix**: Remove alias `'p'` from `plan` command, keep on `pipeline` (more commonly used)

## Affected Files
- `src/index.js` (startup initialization)
- `src/bot/telegram.js` (bot creation)
- `src/bot/commands/handlers/plan.js` (command registration)

## Blast Radius
- Startup pathway: index.js → createTelegramBot() → bot initialization
- No cascading failures to other modules
- Affects only dev startup and bot initialization

## Fix Strategy
1. **Fix #1**: Wrap bot initialization in async IIFE (await-friendly)
2. **Fix #2**: Correct parameter name from `filePath` to `persistencePath`
3. **Fix #3**: Remove duplicate alias `'p'` from plan command

## Expected Outcome
- `npm run dev` starts successfully
- Web server listens on port 8787
- Telegram bot initializes (if ENABLE_TELEGRAM=true)
- Alias store loads without errors
- Command registry has no duplicate aliases
