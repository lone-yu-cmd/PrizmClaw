# Context Snapshot — F-044: Web Panel Resize Handle

## Section 1 — Feature Brief

**Description**: 为 Web 管理台聊天区与右侧面板之间添加可拖拽分隔条，允许用户自由调整两列宽度比例。在 public/styles.css 和 public/index.html 中实现拖拽 resize handle，宽度比例持久化至 localStorage。无后端变更。

**Acceptance Criteria**:
- Given 桌面端（>900px），When 渲染仪表板，Then 聊天区与右侧面板之间显示可拖拽分隔条
- Given 用户拖拽分隔条，When 拖拽进行中，Then 两列宽度实时跟随鼠标位置变化
- Given 用户调整完宽度比例，When 刷新页面，Then 从 localStorage 恢复上次的列宽设置

## Section 2 — Project Structure

- `public/index.html` — main HTML (151 lines)
- `public/styles.css` — main CSS (875 lines)
- `public/js/main.js` — main JS (658 lines)

## Section 3 — Prizm Context

root.prizm:
- Lang: JavaScript (ESM), Node.js 22
- public is static web panel assets, no L1 doc
- CSS/JS conventions: z-index hierarchy, modifier classes, dark mode patterns in CLAUDE.md

Key CSS conventions from CLAUDE.md:
- Use only CSS vars for colors (dark mode auto-switches without explicit override blocks)
- z-index hierarchy: sticky header=10, scroll-to-bottom=50, command dropdown=100, lightbox=200, toast=300
- Resize handle will need z-index above normal content but well below overlays

## Section 4 — Existing Source Files

### public/index.html (151 lines)
Key structure:
- `.app-shell` > `.app-header`, `details.config-panel`, `.session-info-panel`, `main.dashboard-grid`
- `.dashboard-grid` contains: `.panel.chat-panel` and `.panel.side-panel`
- No resize handle element currently

### public/styles.css (875 lines)
Key styles:
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
```
- Mobile breakpoint @media (max-width: 900px): collapses to 1fr
- Mobile 600px: various adjustments
- Uses CSS vars throughout for dark mode support

### public/js/main.js (658 lines)
Key state:
```js
const STORAGE_KEY = 'prizmclaw-web-session';
const FONT_SIZE_KEY = 'prizmclaw-font-size';
```
- localStorage keys follow pattern: `prizmclaw-*`
- `init()` calls loadSessionConfig(), loadFontSize() on startup
- No resize handle logic currently

## Implementation Log
Files changed/created:
- `public/index.html`: added `id="dashboardGrid"` to `<main>`, inserted `<div id="resizeHandle" class="resize-handle">` between chat-panel and side-panel sections
- `public/styles.css`: updated `.dashboard-grid` to use CSS vars `--chat-col`/`--side-col` with 3-column grid (chat / 8px handle / side); added `.resize-handle` styles with `::before` visual indicator, hover/dragging states; added `display: none` to 900px breakpoint
- `public/js/main.js`: added `COLUMN_WIDTHS_KEY` constant, `resizeHandle`/`dashboardGrid` to `els`, `applyColumnWidths()`, `loadColumnWidths()`, `saveColumnWidths()`, `initResizeHandle()` functions; integrated into `init()`

Key decisions:
- CSS vars `--chat-col`/`--side-col` set on `#dashboardGrid` element (not `:root`) to scope to grid only
- Widths stored as fr units normalized to total of 3fr (sum of chat+side fr = 3, same as original 2fr+1fr)
- Min column width enforced at 20% of total to prevent collapse
- `.dragging` class on handle for persistent visual feedback during drag
- Body cursor and userSelect set during drag to prevent text selection and cursor flicker


No tests for frontend code (HTML/CSS/JS files in public/).
Test command: `node --test tests/**/*.test.js`
