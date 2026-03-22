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

### F-020: Enhanced Terminal Output Streaming
- DECISION: ANSI stripping happens in `onAssistantChunk` hook via `ansiProcessChunk()` — raw ANSI bytes from AI CLI stdout are never forwarded to Telegram. Do not strip in the final `replyText` path (already clean from streaming).
- DECISION: Smart segmentation (`segmentOutput`) replaces `splitMessage` ONLY in the streaming render path — the cross-channel push path (`subscribeCrossChannel`) intentionally still uses `splitMessage` (out of scope, different code path).
- DECISION: Output history stores raw `routerResult.reply` (pre-split, pre-file-marker extraction) under key `telegram:{chatId}` — ensures full output is preserved for /output retrieval.
- DECISION: `outputHistoryService` singleton lives in `output.js` and is re-exported to `telegram.js` — tests inject mock via `handlerCtx.outputHistoryService` to avoid mutating shared state across test runs.
- INTERFACE: `processChunk(text)` from `src/utils/ansi-adapter.js` — wraps each raw stdout chunk: strips ANSI then collapses `\r` progress lines. Import as named `ansiProcessChunk` alias.
- INTERFACE: `segmentOutput(text, maxChunkSize=3800)` from `src/utils/output-segmenter.js` — replaces `splitMessage` inside `render()` closure of `createEditableStreamPublisher`.

### F-023: Web Button Hover Animation
- DECISION: `.btn:disabled` uses `pointer-events: none` in addition to `opacity: 0.6` — ensures hover CSS rules never fire on disabled buttons, providing clean visual separation between enabled and disabled states.
- DECISION: Hover effect uses `transform: translateY(-1px)` + `filter: brightness(1.08)` on `.btn:hover` with `transition: transform 0.15s ease, filter 0.15s ease` on `.btn` — applies to all button variants (primary, warning, ghost) without variant-specific overrides.

### F-024: Web Panel Card Shadow Depth
- DECISION: `.panel` and `.sub-panel` are defined as separate CSS rules (not grouped selector) — allows different box-shadow depths to express visual hierarchy: `.panel` uses two-layer shadow (ambient + contact), `.sub-panel` uses single lighter shadow as nested card.
- DECISION: Shadow color uses `rgba(31, 38, 51, ...)` derived from `--text: #1f2633` — ensures cool-tone coordination with `#f4f6fb` background and `#dfe3ef` borders without introducing new color variables.

### F-025: Web Header Sticky Behavior
- DECISION: `.app-header` uses `position: sticky; top: 0` (not `fixed`) — sticky participates in normal document flow at top of page, fixing only when scrolled past. Must pair with `background: var(--bg)` to prevent content bleed-through and `z-index: 10` to overlay panel cards.
- DECISION: `padding-bottom: 12px; margin-bottom: -12px` offsets the `border-bottom` separator from affecting grid gap — keeps visual spacing consistent while showing the separator line.

### F-017: Runtime Config Manager
- DECISION: Safe-to-modify keys whitelist: LOG_LEVEL, REQUEST_TIMEOUT_MS, AI_CLI_HEARTBEAT_MS, MAX_PROMPT_CHARS, MAX_HISTORY_TURNS, SYSTEM_MONITOR_INTERVAL_MS, SESSION_TIMEOUT_MS, TASK_DEBOUNCE_MS — all others are read-only via /config
- DECISION: Hot-reload via `process.env[key] = newValue` — modifying process.env directly makes changes immediately visible to all modules that re-read config at call time (not frozen objects)
- DECISION: `configService.originalEnvValues` uses lazy capture — if env var not present at module init, setConfig captures it on first modification. Reset relies on this map; always call setConfig before reset in tests that set env after module import.
- INTERFACE: `configService.{getAllConfig, getConfig, setConfig, resetConfig, isSafeConfigKey}` — all async, exported from `src/services/config-service.js`

### F-021: Multi-Backend Profile Manager
- DECISION: Default profile name is `'default'` (seeded from `CODEBUDDY_BIN` on first startup) — cannot be removed via `/cli remove`; other profiles can be removed freely.
- DECISION: Profile persistence uses `profileStore.init({persistencePath})` singleton pattern — call `init()` once at startup with the configured path (`config.cliProfilesPath`), then use the singleton throughout. Tests must create isolated `new ProfileStore({persistencePath})` instances.
- DECISION: `backendRegistry.registerBackend()` throws if name already registered — startup code always wraps in try/catch to handle re-registration after restart gracefully.
- DECISION: `/cli add` with inaccessible binary saves the profile to disk but warns the user instead of rejecting — profile is loaded and binary is retried on next `/cli use` or restart.
- DECISION: `/cli use` delegates to existing `sessionStore.setCurrentBackend()` — same F-015 session mechanism; no new session state introduced.
- INTERFACE: `profileStore` singleton from `src/services/profile-store.js` — `init({persistencePath?})`, `addProfile(profile)`, `removeProfile(name)`, `listProfiles()`, `hasProfile(name)`, `setDefaultProfileName(name)`
- INTERFACE: `backendRegistry.updateBackend(name, fields)` from `src/services/backend-registry.js` — updates `permissionFlag`, `timeoutMs`, `description` on an existing registered backend in-place

### F-026: Web Status Indicator Color States
- DECISION: `.status.connected` and `.status.error` are CSS modifier classes — base `.status` keeps layout/sizing; modifiers override only border/background/color. Error palette (#fef3f2, #f9d3d0, var(--danger)) reuses `.message.error` values for visual system consistency.
- DECISION: `setStatus(text, state)` manages class swap via `classList.remove('connected', 'error')` then conditional `classList.add(state)` — null/undefined state = neutral (no class). 'running' and 'accepted' SSE stages use neutral; only 'connected'/'online' and onerror get color states.
- INTERFACE: `setStatus(text, state?)` in `public/js/main.js` — state is `'connected' | 'error' | undefined`; manages CSS class on `#status` element
