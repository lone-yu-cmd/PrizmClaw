# Context Snapshot: F-021 Multi-Backend Profile Manager

## Section 1 — Feature Brief

### Description
多 AI 后端配置档案管理，让用户预设和管理多个 AI CLI 后端配置。在 F-015 基础上，从简单的后端名称切换升级为完整的 profile 管理系统。

命令设计：
- `/cli profiles` 列出所有已保存的后端配置档案
- `/cli add <name> <bin> [--flag=<value>]` 添加新后端配置（如 `/cli add claude claude-internal --timeout=300000`）
- `/cli remove <name>` 删除后端配置
- `/cli use <name>` 切换到指定配置档案

每个 profile 包含：后端名称、bin 路径、权限参数（如 -y）、自定义超时、自定义 prompt 前缀等。Profile 持久化存储到 JSON 文件，Bot 重启后自动加载。

### Acceptance Criteria
- `/cli profiles` 列出所有已保存的后端配置档案及其详细参数
- `/cli add` 可创建新后端配置，支持指定 bin 路径和自定义参数
- `/cli remove` 可删除非当前使用中的后端配置
- `/cli use <name>` 切换到指定配置档案，所有参数（超时、权限等）一并生效
- Profile 持久化存储，Bot 重启后自动加载所有配置档案
- 默认 profile（CODEBUDDY_BIN）不可被删除，可被覆盖参数

## Section 2 — Project Structure

```
src/
  bot/commands/handlers/cli.js          ← main cli command handler (extend)
  services/backend-registry.js         ← backend registry (extend to support profiles)
  services/ai-cli-service.js           ← ai cli executor (reads permissionFlag from session backend)
  config.js                            ← CODEBUDDY_BIN, AI_CLI_BACKENDS, AI_CLI_DEFAULT_BACKEND
tests/bot/commands/handlers/           ← handler tests (add cli.test.js)
tests/services/                        ← service tests (add profile-store.test.js)
```

## Section 3 — Prizm Context

### root.prizm key facts
- TEST_CMD: `node --test tests/**/*.test.js`
- Session keys: bound=`telegram:{chatId}`, unbound web=`web:{sessionId}`
- AI CLI backend switching introduced in F-015

### bot.prizm key facts
- `telegram.js` registers commands via `registerCommand(cliMeta, handleCli)`
- cli.js is the handler for `/cli` command

### services.prizm key facts
- `ai-cli-service.js`: reads `sessionBackend.permissionFlag` from registry when building args

## Section 4 — Existing Source Files

### src/services/backend-registry.js (204 lines)
```js
// BackendRegistry class manages backend registration
// - registerBackend(name, binPath, options) - register with name, path, description, aliases
// - unregisterBackend(name) - remove backend
// - getBackend(name) - lookup by name
// - listBackends() - all backends array
// - validateBackend(name) - check if binary accessible
// - setDefaultBackend(name) / getDefaultBackend()
// - getBackendByAlias(alias)
// - clear()
// Backend object shape: { name, binPath, description, aliases, registeredAt }
// Note: NO permissionFlag, timeout, or prefix fields currently
// Note: registerBackend() throws if backend already registered
// Note: #defaultValidator uses accessSync(X_OK)
export const backendRegistry = new BackendRegistry();
```

### src/bot/commands/handlers/cli.js (193 lines)
```js
// CliCommandHandler class with:
// - handle(ctx, args) - dispatches to subcommand handlers
// - #handleList() - /cli list
// - #handleStatus(sessionKey) - /cli (no subcommand)
// - #handleSwitch(sessionKey, backendName) - /cli <name>
// - #handleReset(sessionKey) - /cli reset
// - #getSessionKey(ctx) - returns "user-{from.id}" or "anonymous"
//
// Current commands: list, reset, <backend>, (empty)
// Missing: profiles, add, remove, use
// Meta: aliases: ['backend', 'ai-backend'], usage: '/cli [list|reset|<backend>]'
export const cliCommandHandler = new CliCommandHandler();
export async function handleCli(handlerCtx) { ... }
```

### src/config.js (relevant parts)
```js
// CODEBUDDY_BIN: default bin path
// CODEBUDDY_PERMISSION_FLAG: default permission flag '-y'
// AI_CLI_BACKENDS: "name1:/path1,name2:/path2" (F-015)
// AI_CLI_DEFAULT_BACKEND: default backend name
// No profile persistence path config yet
```

### src/services/ai-cli-service.js (relevant part ~line 208-244)
```js
// executeAiCli() resolves session backend:
// const sessionBackendName = sessionStore.getCurrentBackend(sessionId);
// const sessionBackend = sessionBackendName ? backendRegistry.getBackend(sessionBackendName) : null;
// const effectiveBin = bin || sessionBackend?.binPath || config.codebuddyBin;
// const permissionFlag = sessionBackend?.permissionFlag || config.codebuddyPermissionFlag;
// const effectiveTimeoutMs = timeoutMs ?? config.requestTimeoutMs;
// NOTE: sessionBackend.permissionFlag is already read but not yet stored in backend objects
```

## Implementation Log
Files changed/created:
- `src/services/profile-store.js` — new ProfileStore service with CRUD and JSON persistence
- `src/services/backend-registry.js` — added permissionFlag/timeoutMs fields, updateBackend() method
- `src/config.js` — added CLI_PROFILES_PATH env var (schema + export)
- `src/bot/commands/handlers/cli.js` — added profiles/add/remove/use subcommands, injected profileStore
- `src/bot/telegram.js` — F-021 startup block: loads profiles, seeds default, registers in backendRegistry
- `tests/services/profile-store.test.js` — 21 tests, all pass
- `tests/bot/commands/handlers/cli.test.js` — 20 tests, all pass

Key decisions:
- Default profile name is 'default' (seeded from CODEBUDDY_BIN on first startup)
- Default profile cannot be removed via /cli remove
- /cli add with inaccessible binary shows ⚠️ warning but still persists the profile
- /cli use delegates to existing sessionStore.setCurrentBackend() — same F-015 session mechanism
- permissionFlag/timeoutMs are stored in BackendRegistry backend objects and already read by ai-cli-service.js


### Pattern (from alias.test.js)
```js
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
// Dynamic import for module isolation
const module = await import(modulePath.href);
// Uses beforeEach/afterEach for fixture setup/teardown
```
