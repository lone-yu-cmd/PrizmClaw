# Context Snapshot — F-043: Web Font Size Accessibility Toggle

## Section 1 — Feature Brief

**Description**: 为 Web 管理台添加字体大小切换控件，支持小/中/大三档，满足不同视力用户的可读性需求。在 public/styles.css 中通过 CSS 变量 --font-scale 控制全局字体倍率，在 public/index.html 中添加切换按钮，选择结果持久化至 localStorage。无后端变更。

**Acceptance Criteria**:
1. Given 页面加载完成，When 渲染字体切换控件，Then 显示小/中/大三个选项，默认选中中档
2. Given 用户选择大字体档，When 切换生效，Then 页面所有文字按比例放大，布局不破损
3. Given 用户刷新页面，When 页面重新加载，Then 上次选择的字体档位从 localStorage 恢复

## Section 2 — Project Structure

- `public/index.html` — 146 lines, HTML entry point for web panel
- `public/styles.css` — 839 lines, CSS for web panel
- `public/js/main.js` — 618 lines, JS for web panel

No backend changes needed — purely frontend work.

## Section 3 — Prizm Context

**root.prizm summary**:
- PROJECT: PrizmClaw — Telegram→AI CLI bridge with web admin panel
- LANG: JavaScript (ESM), Node.js 22
- TEST_CMD: node --test tests/**/*.test.js
- public/ — static web panel assets, no L1 prizm doc

**Relevant CLAUDE.md decisions**:
- F-031 (Dark Mode): CSS vars (`--bg`, `--panel`, etc.) auto-switch with `@media (prefers-color-scheme: dark)`
- F-040 (Collapsible Config): native `<details open>` with `.panel` class
- F-035/036/037/038 (kbd/empty-state/scroll/copy): use only CSS vars so dark mode auto-switches — same pattern applies here
- Web panel z-index hierarchy: header=10, dropdown=100, lightbox=200, toast=300
- STORAGE_KEY: `prizmclaw-web-session` (existing), need separate key for font preference

## Section 4 — Existing Source Files

### public/index.html (146 lines)
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
      <header class="app-header">
        <div>
          <h1>PrizmClaw 管理台</h1>
          <p class="subtitle">聊天、截图、系统命令执行</p>
        </div>
        <div id="status" class="status" role="status" aria-live="polite">就绪</div>
      </header>
      <!-- ... rest of panels ... -->
    </div>
    <div id="lightbox" ...>...</div>
    <div id="toast-container" ...></div>
    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

Key observation: The `<header class="app-header">` has `display: flex; justify-content: space-between; align-items: center`. Currently has a title div and a status div. Font toggle controls should be placed in the header or as a separate element in app-shell.

### public/styles.css (839 lines) — key sections

`:root` block (lines 1-15):
```css
:root {
  color-scheme: light dark;
  --bg: #f4f6fb;
  --panel: #ffffff;
  --line: #dfe3ef;
  --text: #1f2633;
  --muted: #667085;
  --primary: #3a6ff7;
  --primary-contrast: #ffffff;
  --warning: #d97706;
  --danger: #b42318;
  --chat-user: #e9f0ff;
  --chat-assistant: #f5f7fa;
  --radius: 12px;
}
```

`body` (lines 21-26): `font-family`, `color`, `background` — no font-size set (browser default = 16px)

Font size on components: `font-size: 1rem` on summary, `14px` on label, `13px` on status/info-value, `12px` on char-counter, `11px` on info-label/kbd/message-timestamp, `14px` on toast.

Dark mode block (lines 563-625): overrides CSS vars for dark palette

### public/js/main.js (618 lines) — key patterns

Storage pattern (existing):
```js
const STORAGE_KEY = 'prizmclaw-web-session';
function saveSessionConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl, sessionId }));
}
function loadSessionConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = JSON.parse(raw);
  // apply to state
}
```

`els` object: references all DOM elements. Font toggle button elements need to be added here.

`init()` function (lines 385-403): calls `loadSessionConfig()`, sets up DOM state, connects realtime. Font size should be loaded and applied during `init()`.

## Section 5 — Existing Tests

No tests for frontend JS/CSS — test suite is backend only (Node test runner for `tests/**/*.test.js`). Frontend feature has no unit tests to write. Baseline test command: `node --test tests/**/*.test.js`

## Implementation Log
Files changed/created:
- public/styles.css: added `--font-scale: 1` to `:root`, `font-size: calc(1rem * var(--font-scale))` to `body`, `.font-toggle` and `.font-toggle-btn` CSS
- public/index.html: added `.font-toggle` div with 3 buttons (小/中/大) to `<header class="app-header">`
- public/js/main.js: added `FONT_SIZE_KEY`, `els.fontToggleBtns`, `applyFontSize()`, `loadFontSize()`, `setFontSize()`, wired click handlers, called `loadFontSize()` in `init()`

Key decisions:
- `--font-scale` CSS var on `:root`, applied via `body { font-size: calc(1rem * var(--font-scale)) }` — all `rem`-based sizes scale; fixed `px` sizes remain stable (consistent with project conventions)
- Separate localStorage key `prizmclaw-font-size` (not merged into existing STORAGE_KEY) — clean separation of concerns
- Valid scales whitelist `[0.875, 1, 1.2]` in `loadFontSize()` — prevents corrupted localStorage values from causing unexpected scale values
- Default scale 1 (中) applied even if no localStorage entry — `applyFontSize(1)` call also syncs the `.active` class on the HTML button
- Font toggle uses only CSS vars (`--primary`, `--panel`, `--bg`, `--muted`, `--line`, `--text`, `--primary-contrast`) — dark mode auto-switches without explicit `@media (prefers-color-scheme: dark)` override block, consistent with project pattern
