# Context Snapshot — F-040: Web Collapsible Config Panel

## Section 1 — Feature Brief

**Feature**: Web Collapsible Config Panel
**Description**: 将 Web 管理台连接设置区域（.config-panel）改为可折叠面板，默认展开，用户可点击标题栏折叠以节省屏幕空间。在 public/styles.css 和 public/index.html 中实现无 JS 依赖的 details/summary 折叠方案。无后端变更。

**Acceptance Criteria**:
1. Given 页面初次加载，When 渲染配置区，Then 连接设置面板默认展开显示
2. Given 面板展开状态，When 用户点击面板标题，Then 面板内容折叠收起，标题仍可见
3. Given 面板折叠状态，When 用户再次点击标题，Then 面板内容重新展开

## Section 2 — Project Structure

- public/index.html — Web admin panel HTML
- public/styles.css — Web admin panel CSS
- public/js/main.js — Web admin panel JS (no changes needed for this feature)

## Section 3 — Prizm Context

Root: PrizmClaw — Node.js + Express, Telegram bridge + web admin panel
Public assets: no L1 doc, static files only.

Key CSS patterns:
- `.panel` class: background, border, border-radius, padding, box-shadow (two-layer)
- z-index hierarchy: .app-header=10, command-dropdown=100, lightbox=200, toast=300
- Dark mode: @media (prefers-color-scheme: dark) in styles.css
- CSS vars only for dark-auto-switch components; hardcoded palette requires explicit dark override

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

      <!-- CONFIG PANEL (lines 19-31) — TARGET FOR COLLAPSIBLE CHANGE -->
      <section class="panel config-panel">
        <h2>连接设置</h2>
        <div class="form-grid">
          <label>
            API Base URL（可选）
            <input id="baseUrlInput" type="text" placeholder="留空表示同源，例如 http://127.0.0.1:3000" />
          </label>
          <label>
            Session ID
            <input id="sessionIdInput" type="text" placeholder="默认自动生成，可手动修改" />
          </label>
        </div>
      </section>
      <!-- ... rest of panels ... -->
    </div>
  </body>
</html>
```

### public/styles.css (788 lines) — key relevant rules

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: 0 2px 8px rgba(31, 38, 51, 0.08), 0 1px 2px rgba(31, 38, 51, 0.04);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
```

## Section 5 — Existing Tests

No tests exist for public/ static assets (HTML/CSS). Test suite: `node --test tests/**/*.test.js`

## Implementation Log

Files changed/created:
- `public/index.html` — replaced `<section class="panel config-panel">` with `<details class="panel config-panel" open>/<summary>连接设置</summary>`
- `public/styles.css` — added "Collapsible Config Panel" section with `details.config-panel > summary` styles (cursor, flex layout, ▶ arrow indicator rotating 90° when open, margin-bottom when open)

Key decisions:
- Used native `<details>`/`<summary>` elements for zero-JS collapsing; `open` attribute provides default-expanded state
- Arrow indicator uses `::before` pseudo-element (▶, rotates 90° when `[open]`) — consistent with project's use of CSS transitions on interactive elements
- Hid default browser marker via `list-style: none` + `::-webkit-details-marker: none` for cross-browser compatibility
- CSS vars only in summary styles → dark mode auto-switches without explicit override block
