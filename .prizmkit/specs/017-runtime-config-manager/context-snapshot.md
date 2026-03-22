# F-017 Context Snapshot: Runtime Config Manager

## Section 1 — Feature Brief

**Feature**: Runtime Config Manager — 手机端运行时配置查看与修改能力。用户通过 /config 命令在 Telegram 中查看和动态修改 Bot 运行时配置，无需编辑 .env 文件或重启服务。

**Acceptance Criteria**:
- /config 列出所有当前生效配置，token 等敏感字段脱敏显示为 ***
- /config get <KEY> 返回指定配置的当前值
- /config set <KEY>=<VALUE> 动态修改允许的配置项，修改后立即生效
- 敏感配置项（TELEGRAM_BOT_TOKEN 等）不可通过 set 修改，返回拒绝提示
- 配置修改需 admin 权限，非 admin 用户收到权限不足提示
- /config reset <KEY> 可将配置恢复为 .env 中的原始值

**Dependencies**: F-006 (permission-guard.js), F-009 (command registry/routing)

## Section 2 — Project Structure

```
src/
  config.js                          -- main config (uses configService)
  services/config-service.js         -- F-017: runtime config service
  bot/commands/handlers/config.js    -- F-017: /config command handler
  security/permission-guard.js       -- F-006: isAdmin(), COMMAND_MIN_ROLE
  bot/commands/index.js              -- command routing
  bot/commands/registry.js           -- command registration
  bot/telegram.js                    -- registers configMeta + handleConfig
tests/
  services/config-service.test.js    -- 18 unit tests (all pass)
  bot/commands/handlers/config.test.js -- 14 unit tests (all pass)
```

## Section 3 — Prizm Context

root.prizm:
- Config loaded from src/config.js with environment variable support
- Telegram bot uses Telegraf with handlers in src/bot/commands/

bot.prizm:
- createTelegramBot() registers configMeta/handleConfig at line 511
- commands/index.js: Command registry and routing

## Section 4 — Existing Source Files

### src/services/config-service.js (336 lines)
- SAFE_CONFIG_KEYS: LOG_LEVEL, REQUEST_TIMEOUT_MS, AI_CLI_HEARTBEAT_MS, MAX_PROMPT_CHARS, MAX_HISTORY_TURNS, SYSTEM_MONITOR_INTERVAL_MS, SESSION_TIMEOUT_MS, TASK_DEBOUNCE_MS
- SENSITIVE_CONFIG_KEYS: TELEGRAM_BOT_TOKEN, CODEBUDDY_BIN, WEB_HOST, WEB_PORT
- initialize(): captures originalEnvValues from process.env at module load
- getAllConfig(): returns all process.env with sensitive fields masked
- getConfig(key): returns current value, masked if sensitive
- setConfig(key, value): validates, stores in runtimeConfig + updates process.env
- resetConfig(key): restores from originalEnvValues map
- isSafeConfigKey(key): checks SAFE_CONFIG_KEYS whitelist

### src/bot/commands/handlers/config.js (251 lines)
- handleConfig(ctx): routes to list/get/set/reset/help subhandlers
- isAdmin(userId) check from permission-guard.js
- Calls configService.getAllConfig/getConfig/setConfig/resetConfig/isSafeConfigKey

### src/config.js (line 222): runtimeConfig: configService

## Section 5 — Existing Tests

- tests/services/config-service.test.js: 18 tests all passing
- tests/bot/commands/handlers/config.test.js: 14 tests all passing

## Implementation Log

Files changed/created:
- src/services/config-service.js: Fix — capture original env value at first setConfig call if not already stored in originalEnvValues (prevents reset failure when module initialized before env vars set)
- tests/services/config-service.test.js: Add ENABLE_TELEGRAM=true and USER_PERMISSIONS='' to beforeEach test setup

Key decisions:
- Store original env value at setConfig time (lazy capture) rather than only at module init — handles test isolation and cases where env is set after module load
- Tests must explicitly set all env keys they check for in getAllConfig
