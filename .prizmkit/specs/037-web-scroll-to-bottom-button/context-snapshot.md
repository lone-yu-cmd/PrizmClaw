# Context Snapshot — F-037: Web Scroll To Bottom Button

## Section 1 — Feature Brief

**Description**: 为 Web 管理台聊天消息区添加「滚动到底部」浮动按钮。在 public/styles.css 和 public/index.html 中实现当用户向上滚动时出现的固定定位按钮，点击后平滑滚动至最新消息。无后端变更。

**Acceptance Criteria**:
- Given 聊天消息区内容超出高度且用户向上滚动, When 滚动距离超过 100px, Then 显示滚动到底部浮动按钮
- Given 浮动按钮显示, When 用户点击, Then 消息区平滑滚动至最新消息
- Given 消息区已在底部, When 渲染, Then 浮动按钮不显示

**Dependencies**: F-027 (Web Chat Message Fade-In Animation) — completed

## Section 2 — Project Structure

Files to modify:
- `public/index.html` — add scroll-to-bottom button element
- `public/styles.css` — add scroll button styles
- `public/js/main.js` — add scroll detection and click handler

## Section 3 — Prizm Context

From root.prizm:
- Web panel CSS z-index hierarchy: .app-header=10, command-dropdown=100, lightbox=200, toast=300
- public module has no L1 doc (static web panel assets)
- CSS vars: --bg, --panel, --line, --text, --muted, --primary, --primary-contrast
- Dark mode via @media (prefers-color-scheme: dark)
- CSS breakpoints: 900px grid collapse, 600px mobile layout

## Section 4 — Existing Source Files

### public/index.html (113 lines)
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
          <div class="panel-head">...</div>
          <div id="chatMessages" class="chat-messages" aria-live="polite">
            <div id="chatEmptyState" class="empty-state">...</div>
          </div>
          <form id="chatForm" class="chat-form">...</form>
        </section>
        <section class="panel side-panel">...</section>
      </main>
    </div>
    <div id="lightbox" class="lightbox hidden">...</div>
    <div id="toast-container" class="toast-container">...</div>
    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

Key: chat panel contains `#chatMessages` div with `overflow: auto`. Button should be positioned relative to chat-panel or as fixed element near chatMessages.

### public/styles.css (648 lines)
Key rules:
- `.chat-messages`: overflow: auto, min-height: 360px, max-height: 62vh, position: not set (static)
- `.chat-panel`: display: grid, gap: 12px (parent of chatMessages)
- z-index hierarchy: header=10, dropdown=100, lightbox=200, toast=300
- Scroll button should use z-index between dropdown(100) and lightbox(200), e.g. z-index: 50
- CSS vars for theming: --primary, --primary-contrast, --muted, --panel, --line
- `.btn` styles already defined with hover effects

### public/js/main.js (537 lines)
Key:
- `els` object holds all DOM references
- `appendMessage()` calls `els.chatMessages.scrollTop = els.chatMessages.scrollHeight` — auto-scrolls on new messages
- `state` object for app state
- No existing scroll event listener on chatMessages

## Implementation Log
Files changed/created:
- `public/index.html` — wrapped #chatMessages in .chat-messages-wrapper div, added #scrollToBottomBtn button
- `public/styles.css` — added .chat-messages-wrapper (position: relative) and .scroll-to-bottom styles with .visible modifier
- `public/js/main.js` — added els.scrollToBottomBtn, updateScrollToBottomBtn(), scroll event listener, click handler

Key decisions:
- Button positioned absolute inside .chat-messages-wrapper (position: relative) — avoids fixed positioning
- z-index: 50 — above normal content, below command dropdown (100)
- Only CSS vars used → dark mode auto-switches without explicit override block
- Hidden via opacity: 0 + pointer-events: none (not display:none) for smooth fade transition
- updateScrollToBottomBtn() fires on chatMessages scroll event; threshold 100px from bottom
