## PrizmKit Documentation Framework

This project uses PrizmKit with the Prizm documentation system for AI-optimized progressive context loading.

### Progressive Loading Protocol
- ON SESSION START: Always read `.prizm-docs/root.prizm` first (L0 — project map)
- ON TASK: Read L1 (`.prizm-docs/<module>.prizm`) for relevant modules referenced in MODULE_INDEX
- ON FILE EDIT: Read L2 (`.prizm-docs/<module>/<submodule>.prizm`) before modifying files. Pay attention to TRAPS.
- NEVER load all .prizm docs at once. Load only what is needed for the current task.

### Auto-Update Protocol
- BEFORE EVERY COMMIT: Update affected `.prizm-docs/` files
- Platform hooks (rules or UserPromptSubmit) will remind you automatically
- Use `/prizmkit-committer` for the complete commit workflow

### Doc Format Rules
- All `.prizm` files use KEY: value format, not prose
- Size limits: L0 = 4KB, L1 = 3KB, L2 = 5KB
- Arrow notation (->) indicates load pointers to other .prizm docs
- DECISIONS and CHANGELOG are append-only (never delete entries)

### Creating New L2 Docs
- When you first modify files in a sub-module that has no L2 doc:
  1. Read the source files in that sub-module
  2. Generate a new L2 `.prizm` file following Prizm specification
  3. Add a pointer in the parent L1 doc's SUBDIRS section

### Available Commands
Run `/prizm-kit` to see all available PrizmKit commands.

### Fast Path for Simple Changes
Not every change needs the full spec -> plan workflow. Use fast path for:
- Bug fixes with clear root cause, config tweaks, typo fixes, simple refactors
- Documentation-only changes, test additions for existing code
- Fast path: `/prizmkit-plan` (simplified) → `/prizmkit-implement` → `/prizmkit-committer`

Use the full workflow (/prizmkit-specify -> /prizmkit-plan -> /prizmkit-analyze -> /prizmkit-implement) for:
- New features, multi-file coordinated changes, architectural decisions, data model or API changes

### F-018: Web-Telegram Bidirectional Sync
- DECISION: All chat messages (Web + Telegram) must route through `messageRouter.processMessage()` — do not call `executeAiCli` directly for chat. This ensures shared session state and realtimeHub event publishing.
- DECISION: Session key strategy — bound sessions use `telegram:{chatId}`, unbound Web sessions use `web:{sessionId}`. When a web session binds to a Telegram chat, both channels share the same session key.
- DECISION: `createSessionBindService()` uses deferred init pattern — call `ensureReady()` before any sync method in async contexts. Persistence is fire-and-forget; use `flush()` in tests.
- INTERFACE: `createHttpServer({logger, sessionBindingsPath?})` — optional `sessionBindingsPath` for test isolation
- KNOWN GAP: Runtime-created bindings via POST /api/bind do not auto-subscribe realtimeHub for cross-channel push. Only startup-loaded bindings get subscribed. Wire `bot._f018.subscribeCrossChannel(chatId)` from bind handler to fix.
