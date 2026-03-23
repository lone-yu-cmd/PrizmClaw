# Context Snapshot — F-035: Web Keyboard Shortcut Hints

## Section 1 — Feature Brief

**Description**: 在 Web 管理台关键交互元素上显示键盘快捷键提示标签。在 public/styles.css 中为 .kbd 组件添加样式，在发送按钮旁显示 Ctrl+Enter 提示，在命令输入框旁显示 Enter 提示。无后端变更。

**Acceptance Criteria**:
- Given 渲染聊天发送区域, When 页面加载, Then 发送按钮旁显示 Ctrl+Enter 快捷键提示标签
- Given 渲染命令执行区域, When 页面加载, Then 执行按钮旁显示 Enter 快捷键提示标签
- Given .kbd 标签, When 渲染, Then 以等宽字体、圆角边框样式展示，视觉上类似物理键盘按键

## Section 2 — Project Structure

Frontend files:
- public/index.html — main web panel HTML (94 lines)
- public/styles.css — all web panel CSS (582 lines)
- public/js/main.js — web panel JS

## Section 3 — Prizm Context

From root.prizm:
- Web panel CSS z-index hierarchy: .app-header=10, command-dropdown=100, lightbox=200, toast=300
- CSS modifier pattern: .status/.message/.output-box/.toast use modifier classes for state
- Dark mode via @media (prefers-color-scheme: dark) in styles.css; :root color-scheme is `light dark`
- CSS breakpoints: 900px collapses grids; 600px mobile layout

## Section 4 — Existing Source Files

### public/index.html (94 lines)
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

      <section class="panel config-panel">...</section>

      <main class="dashboard-grid">
        <section class="panel chat-panel">
          ...
          <form id="chatForm" class="chat-form">
            <label class="sr-only" for="chatInput">输入消息</label>
            <textarea id="chatInput" rows="3" placeholder="请输入对话"></textarea>
            <div class="char-counter"><span id="charCounter">0</span> / 8000</div>
            <button id="sendChatBtn" type="submit" class="btn primary">发送</button>
          </form>
        </section>

        <section class="panel side-panel">
          <section class="sub-panel">
            <h2>系统命令</h2>
            <form id="execForm" class="exec-form">
              <label class="sr-only" for="execInput">输入系统命令</label>
              <input id="execInput" type="text" placeholder="例如：pwd" />
              <button id="runExecBtn" type="submit" class="btn warning">执行</button>
            </form>
          </section>
        </section>
      </main>
    </div>
    ...
  </body>
</html>
```

Key areas for F-035:
1. Chat form: `.chat-form` contains textarea + `.char-counter` + `#sendChatBtn` — need `.kbd` after the send button area
2. Exec form: `.exec-form` grid (`1fr auto`) contains input + `#runExecBtn` — need `.kbd` after exec button

### public/styles.css (582 lines)
Key existing styles:
- `.chat-form`: display grid, gap 8px — kbd hint goes inside
- `.exec-form`: display grid, `grid-template-columns: 1fr auto`, gap 8px — kbd hint goes in new row
- `.char-counter`: font-size 12px, color var(--muted), text-align right — similar style target for kbd hints
- Dark mode via `@media (prefers-color-scheme: dark)` block at line 435+
- Toast section starts at line 499

## Implementation Log

Files changed/created:
- `public/styles.css` — added `.kbd` component styles (monospace, rounded border, border-bottom-width:2px for key depth) + `.chat-form-actions` and `.exec-form-actions` flex helpers
- `public/index.html` — wrapped send button in `.chat-form-actions` div with `<kbd class="kbd">Ctrl+Enter</kbd>`; wrapped exec button in `.exec-form-actions` div with `<kbd class="kbd">Enter</kbd>`

Key decisions:
- `.kbd` uses CSS vars (`--panel`, `--muted`, `--line`) so dark mode auto-switches without explicit dark override
- `border-bottom-width: 2px` gives physical key depth illusion consistent with common kbd styling conventions
- Wrapper divs (`.chat-form-actions`, `.exec-form-actions`) use `display: flex; align-items: center` to keep button+hint inline without affecting grid layout
- `.exec-form` grid `1fr auto` is preserved — the `auto` column now contains the flex wrapper instead of a bare button

No tests for frontend CSS/HTML features (purely visual components).
Test command: `node --test tests/**/*.test.js`
