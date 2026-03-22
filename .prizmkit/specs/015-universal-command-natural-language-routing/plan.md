# F-015 Plan — Universal Command Natural-Language Routing

## Scope
为 Telegram 命令系统增加统一自然语言路由层，覆盖：
1. `命令 + 自然语言补充`（例如 `/pipeline 帮我看日志`）
2. `纯自然语言意图`（例如 `帮我看一下当前 pipeline 状态`）

同时保持现有严格协议：显式结构化参数优先；低置信度或语义冲突时返回候选动作和确认提示。

## Architecture

### 1) Intent Router Layer（新增）
新增独立模块：`src/bot/commands/intent-router.js`

职责：
- 将文本映射为候选动作（command/subcommand/args）
- 计算置信度并输出排序后的 candidates
- 支持两种模式：
  - **补全模式**（已有命令前缀 `/xxx ...`）
  - **纯自然语言模式**（无 `/`）

输出结构（建议）：
- `matched: boolean`
- `confidence: number`
- `primary: { command, subcommand?, args?, reason } | null`
- `candidates: Array<{ command, subcommand?, args?, confidence, reason }>`
- `needsConfirmation: boolean`
- `ambiguityReason?: string`

### 2) Route Integration（改造）
改造 `src/bot/commands/index.js` 的 `routeCommand(ctx)`：

- 在现有流程中插入两段逻辑：
  1. **Slash Command Enhancement**：当命令存在但子命令无效或文本是自然语言补充时，调用 intent router 做子命令补全/修正
  2. **Pure NL Routing**：当消息不以 `/` 开头时，先走 intent router，命中高置信度则合成命令并复用现有验证与 handler 链路；低置信度返回候选建议

- 保持既有安全链路不变：
  - `isAllowedUser` 授权
  - `checkCommandPermission` 权限
  - `validateCommand` 参数验证

### 3) Structured-First Policy（优先级策略）
实现并验证以下优先级：
1. 显式结构化输入优先（有效 subcommand / 显式 options）
2. 仅在结构化信息缺失、无效或明显为自然语言补充时启用推断
3. 冲突时不静默覆盖，返回候选动作 + 确认提示

### 4) UX / Error Feedback（可解释输出）
在 `src/bot/commands/formatter.js`（或 index.js 内的响应拼装）补充统一提示模板：
- 低置信度：`我不完全确定你的意图，候选动作如下...`
- 冲突：`检测到显式参数与语义推断冲突，已按显式参数执行/请确认`（按策略）
- 不再直接仅返回“未知子命令”作为唯一反馈（对可推断场景）

## Data Flow

### A. Slash + NL
`/pipeline 帮我看最近日志`
→ parseCommand
→ command= pipeline，subcommand= 帮我看最近日志（无效）
→ intent-router 在 pipeline 作用域内推断为 logs
→ validateCommand（结构化后）
→ handler 执行

### B. Pure NL
`帮我看一下当前 pipeline 状态`
→ routeCommand 进入 pure NL 分支
→ intent-router 推断 `pipeline status`
→ 合成 ParsedCommand（或合成命令文本后复用 parse）
→ validate + permission + handler

### C. Ambiguous
`帮我处理一下`
→ intent-router 多候选且低置信度
→ 返回 candidates（如 pipeline status / planner status / jobs）
→ 请求用户确认，不直接报 unknown subcommand

## Files To Modify / Create

### Create
- `src/bot/commands/intent-router.js`（新）
- `tests/bot/commands/intent-router.test.js`（新）
- `tests/integration/f015-nl-routing.integration.test.js`（新，测试矩阵）

### Modify
- `src/bot/commands/index.js`（接入 NL 路由与候选反馈）
- `src/bot/commands/formatter.js`（如需新增候选/冲突提示格式）
- `tests/bot/commands/parser.test.js`（必要时补充命令+NL 输入场景）
- `tests/integration/f002-command-router.integration.test.js`（保持兼容断言）

## Testing Strategy

1. 单元测试（intent-router）
- 多命令类别：pipeline/planner/bugfix/file/system
- 关键词匹配与置信度排序
- 冲突/歧义检测

2. 路由集成测试（routeCommand）
- slash + NL 补全
- pure NL 路由
- 低置信度候选提示
- structured-first 不回归

3. 回归测试
- 现有 `/pipeline run ...`、`/bugfix ...`、`/ls ...`、`/ps ...` 等严格输入行为保持

## Tasks

- [x] T1: Add intent router module (`src/bot/commands/intent-router.js`) with scoring, candidate ranking, and ambiguity detection
- [x] T2: Add unit tests for intent router (`tests/bot/commands/intent-router.test.js`) using command-category matrix and ambiguity cases
- [x] T3: Integrate slash-command NL enhancement in `routeCommand` while preserving explicit structured precedence
- [x] T4: Integrate pure-NL routing path in `routeCommand` with safe fallback (candidate suggestions + confirmation prompt)
- [x] T5: Update/extend formatter and routing error output so low-confidence/semantic-conflict returns candidates instead of only unknown subcommand
- [x] T6: Add integration tests (`tests/integration/f015-nl-routing.integration.test.js`) for acceptance criteria matrix (multi-category, ambiguity, fallback)
- [ ] T7: Run targeted tests for new/changed suites and then project tests; fix regressions until passing
- [ ] T8: Mark all tasks complete and append Implementation Log to `context-snapshot.md`