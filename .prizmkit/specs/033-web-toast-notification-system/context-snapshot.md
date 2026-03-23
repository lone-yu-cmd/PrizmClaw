# Context Snapshot — F-033: Web Toast Notification System

## Section 1 — Feature Brief

**Feature**: 为 Web 管理台添加轻量 Toast 通知组件，用于操作成功/失败的临时提示。在 public/styles.css 和 public/index.html 中实现固定定位的 toast 容器，支持 success/error/info 三种类型，3 秒后自动消失。无后端变更。

**Acceptance Criteria**:
- Given 操作成功（如发送消息），When JS 调用 showToast(msg, 'success')，Then 页面右下角出现绿色 toast 提示
- Given 操作失败，When JS 调用 showToast(msg, 'error')，Then 出现红色 toast 提示
- Given toast 显示后 3 秒，When 计时结束，Then toast 以淡出动画消失

## Section 2 — Project Structure

```
public/
  index.html       (92 lines) — main HTML with app shell, lightbox div at end of body
  styles.css       (472 lines) — CSS with :root vars, dark mode @media, animations
  js/
    main.js        (485 lines) — all frontend JS logic
```

## Section 3 — Prizm Context

Root: PrizmClaw — Telegram AI CLI bridge with web admin panel
- public/ has no L1 doc
- CSS uses CSS vars: --bg, --panel, --line, --text, --muted, --primary, --danger, --warning
- Dark mode via @media (prefers-color-scheme: dark), overrides CSS vars and hardcoded colors
- Existing patterns: fade-in @keyframes, .hidden utility class, modifier pattern (.status.connected, .status.error)
- z-index hierarchy: .app-header=10, command dropdown=100, lightbox=200

## Section 4 — Existing Source Files

### public/index.html (92 lines)

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
      <header class="app-header">...
      </header>
      <section class="panel config-panel">...
      </section>
      <main class="dashboard-grid">...
      </main>
    </div>

    <div id="lightbox" class="lightbox hidden" ...>
      <img id="lightboxImg" class="lightbox-img" ... />
    </div>

    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

### public/styles.css (472 lines)

Key patterns for toast:
- :root CSS vars: --bg, --panel, --line, --text, --muted, --primary, --danger, --warning, --radius
- @keyframes fade-in: opacity 0→1 + translateY(4px)→0
- .hidden { display: none }
- z-index: header=10, dropdown=100, lightbox=200 → toast should use z-index: 300
- Dark mode: @media (prefers-color-scheme: dark) overrides
- Success palette: #ecfdf3 bg, #a6f4c5 border, #027a48 color (from .status.connected)
- Dark success: #14532d bg, #166534 border, #4ade80 color
- Error palette: #fef3f2 bg, #f9d3d0 border, var(--danger) color
- Dark error: #450a0a bg, #7f1d1d border, var(--danger) color
- Info: use --panel bg, --line border, --text color (neutral)

### public/js/main.js (485 lines)

Key patterns:
- `els` object for DOM element refs — add `toastContainer` ref
- setStatus(text, state?) — modifier class pattern to follow
- appendMessage, createMessageElement — similar DOM creation pattern
- openLightbox/closeLightbox — show/hide pattern with .hidden class
- document.addEventListener('keydown') for global keyboard events
- init() function at bottom bootstraps everything

## Implementation Log
Files changed/created:
- public/index.html: added `<div id="toast-container" class="toast-container">` before `</body>`
- public/styles.css: added `.toast-container`, `.toast`, `.toast.success/error/info`, `.toast.toast-fade-out`, `@keyframes toast-slide-in`, `@keyframes toast-fade-out`, dark mode overrides
- public/js/main.js: added `toastContainer` to `els`, added `showToast(msg, type)` function with 3s auto-dismiss + fade-out, wired to chat/screenshot/exec handlers

Key decisions:
- z-index: 300 for toast container (above lightbox at 200)
- TOAST_DURATION_MS=3000, TOAST_FADE_MS=300 (separate constants for display vs animation)
- `.toast-fade-out` class triggers CSS animation then removes element from DOM
- Success palette reuses .status.connected colors; error palette reuses .status.error colors (system consistency)
- Dark mode overrides for success/error toasts follow existing dark palette patterns
