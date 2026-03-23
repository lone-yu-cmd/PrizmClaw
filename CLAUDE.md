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

### F-027: Web Chat Message Fade-In Animation
- DECISION: `.message` uses `animation: fade-in 0.25s ease-out both` — `both` fill-mode is critical: ensures opacity:0 before animation starts and opacity:1 after ends, preventing flash-of-transparent or flash-of-animated-end states. Do not use `forwards` alone (pre-start flash) or omit fill-mode (post-end reset).
- DECISION: `@keyframes fade-in` combines opacity 0→1 with `translateY(4px)→0` for subtle depth — pure opacity-only fade looks flat; small Y offset adds natural rise-in feel without distracting movement. 0.25s ease-out is the project standard for message appear animations.

### F-028: Web Input Character Counter
- DECISION: Character limit is hardcoded to 8000 in frontend (CHAR_LIMIT = 8000) matching MAX_PROMPT_CHARS backend default — avoids API call on page load while keeping parity with backend limit.
- DECISION: Warning threshold is 80% of limit (6400) — `classList.toggle('warning', len >= CHAR_WARN_THRESHOLD)` on the `.char-counter` wrapper div (parent of `#charCounter` span). Toggle on wrapper, not span, so CSS `.char-counter.warning` selector works cleanly.
- DECISION: `updateCharCounter()` is called in both the `input` event handler and after `els.chatInput.value = ''` on submit — ensures counter resets to 0 after send without a separate reset path.
- INTERFACE: `updateCharCounter()` in `public/js/main.js` — reads `els.chatInput.value.length`, updates `els.charCounter.textContent`, toggles `.warning` class on `els.charCounter.parentElement`

### F-029: Web Output Box Syntax Highlight
- DECISION: `.output-box.error` reuses existing error palette (#fef3f2 bg, #f9d3d0 border, var(--danger) color) consistent with `.message.error` and `.status.error` — palette system consistency, no new color variables introduced.
- DECISION: `.output-box.exit-error` uses amber warning palette (#fffbf0 bg, #fde8bb border, var(--warning) color) for non-zero exit codes — distinct from error (red) to signal warning vs failure.
- DECISION: `classList.remove('exit-error', 'error')` called before each exec run in `els.execForm submit` handler — ensures clean visual state on repeated runs; toggle/add in try/catch paths apply state.
- INTERFACE: `.output-box.error` in `public/styles.css` — applied to `#stderrOutput` when `data.stderr` is non-empty; `.output-box.exit-error` applied to `#exitCodeOutput` when `data.exitCode !== 0`

### F-030: Web Responsive Mobile Layout
- DECISION: Mobile breakpoint is @media (max-width: 600px) — below existing 900px breakpoint which only collapses grids; 600px targets phone-specific layout issues (header overflow, exec-form button stacking, reduced padding).
- DECISION: `.app-header` uses `flex-wrap: wrap` at 600px (not column layout) — allows natural wrap when title+status won't fit, preserving flex alignment without forcing full column stack on slightly-larger phones.
- DECISION: `.status` gets `max-width: 140px` + `text-overflow: ellipsis` at 600px — prevents status indicator from overlapping title div; ellipsis chosen over hiding to preserve status visibility.
- DECISION: `.exec-form` collapses from `1fr auto` to `1fr` at 600px — exec button becomes full-width row below input, consistent with chat-form send button behavior on mobile.

### F-031: Web Dark Mode Support
- DECISION: Dark mode implemented via `@media (prefers-color-scheme: dark)` in `public/styles.css` — no JS toggle, no backend changes; automatically follows OS theme and reverts when OS switches back to light.
- DECISION: Dark palette anchors: `--bg: #111827`, `--panel: #1f2937`, `--line: #374151`, `--text: #f9fafb`, `--muted: #9ca3af`, `--primary: #5b8df8` (lightened for dark bg contrast), `--danger: #f87171` (lightened red), `--warning: #f59e0b`, `--chat-user: #1e3a5f`, `--chat-assistant: #263144`.
- DECISION: Hardcoded `background: #fff` on `input`, `textarea`, `.chat-messages`, `.output-box`, `.screenshot-image` are overridden to `var(--panel)` inside the dark media query — these elements do not use CSS vars in light mode so cannot auto-switch without explicit overrides.
- DECISION: `.status.connected`, `.status.error`, `.message.error`, `.output-box.error`, `.output-box.exit-error` use hardcoded light-mode palette values; dark mode overrides use deep red (`#450a0a` bg, `#7f1d1d` border) and deep amber (`#431407` bg, `#78350f` border) for readable dark-appropriate contrast — same semantic color system, adapted for dark surfaces.
- DECISION: `:root { color-scheme: light dark }` — signals browser to render system UI (scrollbars, form controls) in the matching scheme; was `light` only before F-031.

### F-032: Web Screenshot Preview Lightbox
- DECISION: Lightbox overlay uses `position: fixed; inset: 0; z-index: 200` (above `.app-header` z-index: 10 and command dropdown z-index: 100) — always use fixed + inset:0 for true full-screen overlays that scroll independently of page content.
- DECISION: Esc to close lightbox is handled via `document.addEventListener('keydown')` (not on a specific element) — ensures Esc works regardless of which element has focus; check `!els.lightbox.classList.contains('hidden')` before closing to avoid interfering with other Esc handlers.
- DECISION: Lightbox backdrop click detection uses `event.target !== els.lightboxImg` — clicking the image itself does not close; clicking any part of the dark overlay does. No dark mode override needed for `rgba(0,0,0,0.8)` backdrop — black works in both light and dark themes.
- INTERFACE: `openLightbox(src)` / `closeLightbox()` in `public/js/main.js` — open sets `#lightboxImg.src` and removes `.hidden` from `#lightbox`; close adds `.hidden` back and clears src to free memory.

### F-033: Web Toast Notification System
- DECISION: `#toast-container` uses `position: fixed; bottom: 20px; right: 20px; z-index: 300` (above lightbox z-index: 200) — fixed positioning ensures toasts float above all page content; z-index 300 is the ceiling in the web panel z-index hierarchy.
- DECISION: Toast auto-dismiss uses two-step timing: `TOAST_DURATION_MS=3000` display duration → add `.toast-fade-out` class → `TOAST_FADE_MS=300` CSS animation plays → `toast.remove()` — the two constants are kept separate so display and animation durations can be tuned independently.
- DECISION: `.toast.success` and `.toast.error` palettes reuse `.status.connected` (#ecfdf3/#a6f4c5/#027a48) and `.status.error` (#fef3f2/#f9d3d0/--danger) values — system color consistency; `.toast.info` uses neutral --panel/--line/--text (no new palette introduced).
- DECISION: Dark mode overrides required only for `.toast.success` and `.toast.error` — `.toast.info` uses CSS vars that auto-switch with the dark media query; `.toast.success`/`.toast.error` use hardcoded light palette values same pattern as other modifier classes.
- INTERFACE: `showToast(msg, type?)` in `public/js/main.js` — type is `'success' | 'error' | 'info'` (default `'info'`); appends `.toast.{type}` div to `#toast-container`; auto-removes after 3s with fade-out animation.

### F-034: Web Loading Spinner Component
- DECISION: `.btn.loading` uses `color: transparent` to hide button text and `::before` pseudo-element as spinner — no extra DOM elements needed; `position: relative` on button + `position: absolute; inset: 0; margin: auto` on `::before` centers spinner without affecting layout.
- DECISION: Spinner arc colors use explicit `rgba(255,255,255,0.5)` track + `#fff` active arc (not `currentColor`) — because `.btn.loading` sets `color: transparent`, `currentColor` would inherit transparent and make spinner invisible. Both `.btn.primary` and `.btn.warning` have white text, so white spinner works for all button variants.
- DECISION: `setBusy(busy, text, activeBtn=null)` — optional third param; when busy=true adds `.loading` to activeBtn only (shows which operation is running); when busy=false removes `.loading` from all three buttons; backward-compatible (null = no spinner shown, all buttons still disable).
- INTERFACE: `setBusy(busy, text, activeBtn?)` in `public/js/main.js` — activeBtn is `els.sendChatBtn | els.takeScreenshotBtn | els.runExecBtn | null`; adds `.loading` class on busy, removes from all on idle

### F-035: Web Keyboard Shortcut Hints
- DECISION: `.kbd` uses only CSS vars (`--panel`, `--muted`, `--line`) — no hardcoded colors, so dark mode auto-switches without an explicit `@media (prefers-color-scheme: dark)` override block. Do not introduce hardcoded palette values into `.kbd`.
- DECISION: `border-bottom-width: 2px` on `.kbd` provides physical key depth illusion — this is the standard kbd key styling convention; do not flatten to uniform `1px` border.
- DECISION: Wrapper divs `.chat-form-actions` and `.exec-form-actions` (flex, align-items: center, gap: 8px) hold button+kbd pairs inline — the `.exec-form` grid `1fr auto` column structure is preserved; the `auto` column now contains the flex wrapper instead of a bare button. Do not break the grid column counts when adding inline hints.
- INTERFACE: `.kbd` in `public/styles.css` — monospace font, 3px/6px padding, 5px border-radius, border-bottom-width: 2px, var(--panel) bg, var(--muted) color; used inline next to buttons wrapped in `.chat-form-actions` / `.exec-form-actions` flex containers

### F-036: Web Empty State Illustrations
- DECISION: `updateChatEmptyState()` queries `.message.user, .message.assistant` only — system messages (welcome, clear-confirmation) do NOT trigger empty state hide, preserving the guide text until the user actually sends a message.
- DECISION: `clearChatBtn` listener must re-append `els.chatEmptyState` DOM node after `chatMessages.innerHTML = ''` before calling `appendMessage()` — clearing innerHTML destroys all child elements including the empty state node; re-appending restores it so the next appendMessage call can find and evaluate it.
- DECISION: `.empty-state` uses only CSS vars (`--muted`, `--text`) — no hardcoded palette values, so dark mode auto-switches without an explicit `@media (prefers-color-scheme: dark)` override block. Same pattern as `.kbd`.
- DECISION: Exec output boxes wrapped in `#execOutput` div (hidden by default) with `#execEmptyState` as sibling — `updateExecEmptyState(hasResult)` toggles both elements as a unit, keeping the three output boxes (#exitCodeOutput, #stdoutOutput, #stderrOutput) logically grouped.
- INTERFACE: `updateChatEmptyState()` in `public/js/main.js` — called inside `appendMessage()` after every DOM append; checks for `.message.user, .message.assistant` to decide visibility of `#chatEmptyState`
- INTERFACE: `updateExecEmptyState(hasResult)` in `public/js/main.js` — called in execForm submit handler (both success and error paths); `hasResult=true` hides `#execEmptyState` and shows `#execOutput`

### F-037: Web Scroll To Bottom Button
- DECISION: `#scrollToBottomBtn` wrapped in `.chat-messages-wrapper` (position: relative) alongside `#chatMessages` — button uses `position: absolute; bottom: 12px; right: 12px` to anchor inside the messages area without affecting page flow or conflicting with sticky header or fixed overlays.
- DECISION: Button hidden via `opacity: 0; pointer-events: none` (not `display: none`) + `.visible` class adds `opacity: 1; pointer-events: auto` — allows CSS transition for smooth fade without layout reflow; z-index: 50 places it above normal content but below command dropdown (100).
- DECISION: `.scroll-to-bottom` uses only CSS vars (`--panel`, `--line`, `--muted`, `--primary`, `--primary-contrast`) — dark mode auto-switches without an explicit `@media (prefers-color-scheme: dark)` override block. Same pattern as `.kbd` and `.empty-state`.
- DECISION: `updateScrollToBottomBtn()` threshold is 100px from bottom (`scrollHeight - scrollTop - clientHeight > 100`) — `appendMessage()` already sets `scrollTop = scrollHeight`, so button hides automatically when new messages arrive; no explicit hide call needed in appendMessage.
- INTERFACE: `updateScrollToBottomBtn()` in `public/js/main.js` — called on `chatMessages` scroll event; toggles `.visible` class on `#scrollToBottomBtn`; threshold 100px from bottom

### F-038: Web Copy To Clipboard Button
- DECISION: Each `.output-box` wrapped in `.output-box-wrapper` (position: relative) — copy button uses `position: absolute; top: 6px; right: 6px` to anchor at top-right corner of each output box without affecting document flow.
- DECISION: `.copy-btn` uses only CSS vars (`--panel`, `--line`, `--muted`, `--primary`, `--primary-contrast`) — dark mode auto-switches without an explicit `@media (prefers-color-scheme: dark)` override block. Same pattern as `.kbd`, `.empty-state`, `.scroll-to-bottom`.
- DECISION: `data-target` attribute on `.copy-btn` holds the ID of the corresponding output box — decouples HTML binding from JS; delegated `document.click` listener finds `.copy-btn` via `event.target.closest('.copy-btn')` and reads `btn.dataset.target` to get the element. No per-button event listeners needed.
- DECISION: Empty check in `copyToClipboard(el)` trims text and also treats `'-'` (exitCodeOutput initial value) as empty — both cases show `'内容为空'` info toast; non-empty content writes to clipboard via `navigator.clipboard.writeText()` and shows `'已复制'` success toast.
- INTERFACE: `copyToClipboard(el)` in `public/js/main.js` — async; reads `el.textContent.trim()`; shows info toast on empty/'-', writes clipboard and shows success toast on content, shows error toast on clipboard API failure

### F-039: Web Session Info Display Panel
- DECISION: Session info panel uses `<dl>` with `.info-grid` (auto-fit columns, minmax 200px) + `.info-row` (flex column) layout — definition list is semantically correct for label/value pairs; auto-fit grid adapts to panel width without media query breakpoints.
- DECISION: `.info-value.connected` uses hardcoded green (#027a48 light / #4ade80 dark) with explicit dark mode override — same palette as `.status.connected` for visual system consistency; dark mode block required because value is hardcoded, not CSS-var-based.
- DECISION: `state.telegramChatId` is null by default in `state` object — panel shows "未绑定" with `.info-value.muted` (italic, var(--muted) color) when null; set to a string value when bind event arrives; no backend changes needed for display.
- DECISION: `updateSessionInfoPanel(connState?)` accepts optional connState arg — called from `init()` (no arg → neutral "就绪" state), SSE 'connected' event (arg='connected'), SSE onerror (arg='error'), and `sessionIdInput` change handler (no arg → keep current visual state after reconnect).
- INTERFACE: `updateSessionInfoPanel(connState?)` in `public/js/main.js` — connState is `'connected' | 'error' | undefined`; updates `#infoSessionId`, `#infoConnState`, `#infoTelegramChatId` DOM elements; reads `state.sessionId` and `state.telegramChatId`

### F-040: Web Collapsible Config Panel
- DECISION: `.config-panel` uses native `<details open>`/`<summary>` elements (not JS toggle) — zero JS dependency; `open` attribute provides default-expanded state; browser handles toggle natively; no ARIA or JS state management needed.
- DECISION: `<section class="panel config-panel">` replaced by `<details class="panel config-panel" open>` — the `.panel` class stays on `<details>` so box-shadow/border/padding styles apply unchanged; `<h2>` title replaced by `<summary>` element.
- DECISION: `summary::before` ▶ arrow uses `transition: transform 0.2s ease` + rotates 90° on `details[open]` — provides animated visual cue for open/closed state; uses only CSS vars (`--muted`) so dark mode auto-switches without explicit override block.
- DECISION: Default browser disclosure marker hidden via `list-style: none` on summary + `summary::-webkit-details-marker: display: none` — cross-browser normalization; custom `::before` arrow replaces it consistently.

### F-041: Web Message Timestamp Display
- DECISION: `.message` changed from `display: block` to `display: flex; flex-direction: column` — allows timestamp span to sit at bottom with `text-align: right` without absolute positioning; `.message .body` class extracts `white-space: pre-wrap; word-break: break-word` (was on `.message`) since flex parent doesn't need it.
- DECISION: `formatTimestamp()` uses `new Date()` at call time (moment of render) — captures accurate send time for user messages and receive time for assistant messages; called inside `createMessageElement()`.
- DECISION: `.message-timestamp` uses only CSS vars (`--muted`) — dark mode auto-switches without explicit `@media (prefers-color-scheme: dark)` override block; same pattern as `.kbd`, `.empty-state`, `.scroll-to-bottom`, `.copy-btn`.
- INTERFACE: `formatTimestamp()` in `public/js/main.js` — returns `HH:MM` string in local time; called by `createMessageElement()` to stamp each message at render time
- INTERFACE: `.message-timestamp` in `public/styles.css` — `display: block; font-size: 11px; color: var(--muted); text-align: right; margin-top: 4px; user-select: none`; sibling of `.body` inside `.message` flex container
