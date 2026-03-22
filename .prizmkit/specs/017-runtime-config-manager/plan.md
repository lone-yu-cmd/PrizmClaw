# F-017: Runtime Config Manager — Plan

## Overview

Implement Telegram `/config` command for viewing and modifying bot runtime config without restart.

## Key Components

1. **Config Service** (`src/services/config-service.js`) — runtime config store with hot-reload
2. **Config Handler** (`src/bot/commands/handlers/config.js`) — /config command dispatch
3. **Permission Guard** — admin-only access via `isAdmin()` from F-006
4. **Registry** — registered in `telegram.js` at bot init

## Data Flow

```
/config [subcommand] → handleConfig() → isAdmin() check
  → configService.getAllConfig()  (list)
  → configService.getConfig(key)  (get)
  → configService.isSafeConfigKey() → configService.setConfig() (set)
  → configService.isSafeConfigKey() → configService.resetConfig() (reset)
```

## Files Changed/Created

- `src/services/config-service.js` — runtime config service (existed, bug fixed)
- `src/bot/commands/handlers/config.js` — command handler (existed, complete)
- `src/config.js` — imports configService (existed)
- `src/security/permission-guard.js` — config:admin entry (existed)
- `src/bot/telegram.js` — registers command at line 511 (existed)
- `tests/services/config-service.test.js` — 18 tests (existed, fixed env setup)
- `tests/bot/commands/handlers/config.test.js` — 14 tests (existed, passing)

## Tasks

- [x] Verify config-service.js: safe key whitelist, sensitive masking, hot-reload via process.env
- [x] Verify config handler: list/get/set/reset/help subcommands, admin check
- [x] Verify command registration in telegram.js and permission-guard.js
- [x] Fix bug: originalEnvValues lazy capture in setConfig to support test isolation
- [x] Fix test: add missing env vars to beforeEach in config-service.test.js
- [x] Run all F-017 tests — 32 tests pass (18 service + 14 handler)
