# Context Snapshot — F-039: Web Session Info Display Panel

## Section 1 — Feature Brief

**Description**: 在 Web 管理台连接设置区域下方添加当前会话信息展示面板，显示 Session ID、连接状态、已绑定 Telegram Chat ID 等运行时信息。在 public/styles.css 和 public/index.html 中实现只读信息卡片组件。无后端变更。

**Acceptance Criteria**:
- Given 页面加载完成，When 渲染会话信息面板，Then 显示当前 Session ID 和连接状态
- Given SSE 连接建立，When 状态更新，Then 面板中连接状态实时刷新
- Given 已绑定 Telegram Chat ID，When 渲染面板，Then 显示绑定的 Chat ID 信息

## Section 2 — Project Structure

Files to modify:
- `public/index.html` (128 lines) — add session info panel section after config-panel
- `public/styles.css` (728 lines) — add .session-info-panel CSS
- `public/js/main.js` (572 lines) — add updateSessionInfoPanel() function, call from SSE events and init

## Section 3 — Prizm Context

From root.prizm:
- Web panel static assets in `public/` — no L1 doc
- CSS vars: --bg, --panel, --line, --text, --muted, --primary, --primary-contrast, --warning, --danger
- CSS modifier pattern: state classes override base; dark mode overrides hardcoded light-palette values
- Z-index hierarchy: header=10, command-dropdown=100, lightbox=200, toast=300
- Dark mode: @media (prefers-color-scheme: dark); use only CSS vars to auto-switch
- Status: setStatus(text, state) in main.js; state='connected'|'error'|undefined
- SSE events: 'connected', 'status' (with payload.stage), 'assistant_chunk', 'assistant_done'

Key decisions from F-026, F-035, F-036, F-037, F-038:
- Use only CSS vars (no hardcoded colors) for auto dark mode switching
- Modifier class pattern for state-based styling

## Section 4 — Existing Source Files

### public/index.html (128 lines)
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PrizmClaw 管理台</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="app-header">...</header>

      <section class="panel config-panel">
        <h2>连接设置</h2>
        <div class="form-grid">
          <label>API Base URL（可选）<input id="baseUrlInput" .../></label>
          <label>Session ID<input id="sessionIdInput" .../></label>
        </div>
      </section>

      <!-- F-039: session info panel goes here, after config-panel -->

      <main class="dashboard-grid">...</main>
    </div>
    <div id="lightbox"...>...</div>
    <div id="toast-container"...></div>
    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

### public/js/main.js (572 lines)
Key sections relevant to F-039:
- `state` object: baseUrl, sessionId, busy, eventSource, ...
- `els` object: references to DOM elements
- `setStatus(text, state)`: updates header status indicator
- `connectRealtime()`: sets up SSE, handles 'connected'/'status'/'assistant_chunk'/'assistant_done' events
- `init()`: called at bottom; loads config, sets sessionId, calls connectRealtime()
- `loadSessionConfig()`: reads from localStorage; sets state.baseUrl and state.sessionId
- `els.sessionIdInput.addEventListener('change', ...)`: updates state.sessionId on manual change
- SSE 'connected' event: setStatus('实时通道已连接', 'connected')
- SSE 'status' event: handles stage=running/accepted/other

### public/styles.css (728 lines)
Key patterns:
- `.panel` / `.sub-panel`: card styles with box-shadow depth
- `.status` / `.status.connected` / `.status.error`: color state modifiers
- Dark mode: @media (prefers-color-scheme: dark) — must override hardcoded colors, CSS vars auto-switch
- CSS vars: --bg, --panel, --line, --text, --muted, --primary, --primary-contrast

## Section 5 — Existing Tests

No frontend-specific tests (no DOM tests for web panel). Backend tests in tests/ cover services.
This feature is frontend-only (HTML/CSS/JS), no new tests required.

## Implementation Log

Files changed/created:
- `public/index.html` — added `<section class="panel session-info-panel">` with info-grid/info-row/info-label/info-value elements for Session ID, connection state, Telegram Chat ID
- `public/styles.css` — added `.session-info-panel`, `.info-grid`, `.info-row`, `.info-label`, `.info-value`, `.info-value.muted`, `.info-value.connected`, `.info-value.error` + dark mode override for `.info-value.connected`
- `public/js/main.js` — added `state.telegramChatId`, els refs (`infoSessionId`, `infoConnState`, `infoTelegramChatId`), `updateSessionInfoPanel(connState?)` function; wired to `init()`, SSE 'connected' event, SSE onerror, `sessionIdInput` change handler

Key decisions:
- CSS uses only CSS vars for all colors except `.info-value.connected` (hardcoded green #027a48 / dark mode #4ade80) — same pattern as `.status.connected` in F-026
- `updateSessionInfoPanel(connState?)` accepts optional connState arg; when called from init() with no arg, shows neutral "就绪" state
- `state.telegramChatId` is null by default; populated externally when bind event arrives (future feature scope)
