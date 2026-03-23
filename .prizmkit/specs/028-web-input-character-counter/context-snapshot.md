# Context Snapshot — F-028: Web Input Character Counter

## Section 1 — Feature Brief

**Description**: Add a character counter display to the Web admin panel chat input (chatInput). The counter updates in real-time as the user types, shows a warning color when approaching the character limit.

**Acceptance Criteria**:
- Given user types in chatInput, When character count changes, Then counter shows current count in real-time
- Given character count exceeds 80% of limit, When rendering counter, Then counter shows in warning color (--warning)
- Given input is empty, When rendering counter, Then counter shows 0 in default style

**Character Limit**: MAX_PROMPT_CHARS = 8000 (from src/config.js)

## Section 2 — Project Structure

```
public/
  index.html     — single-page admin panel
  styles.css     — all CSS styles
  js/
    main.js      — all frontend JS logic
```

No backend changes needed.

## Section 3 — Prizm Context

- PROJECT: PrizmClaw — Telegram → AI CLI bridge with web admin panel
- LANG: JavaScript (ESM), Node.js 22
- public/ — static web panel assets (no L1 doc)
- RULE: .btn:disabled uses pointer-events: none
- RULE: .message uses animation: fade-in 0.25s ease-out both
- RULE: .status uses modifier classes .connected/.error via classList
- CSS vars: --warning: #d97706, --text: #1f2633, --muted: #667085, --line: #dfe3ef, --primary: #3a6ff7

## Section 4 — Existing Source Files

### public/index.html (87 lines)

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

      <main class="dashboard-grid">
        <section class="panel chat-panel">
          <div class="panel-head">
            <h2>双向聊天</h2>
            <button id="clearChatBtn" type="button" class="btn ghost">清空界面消息</button>
          </div>

          <div id="chatMessages" class="chat-messages" aria-live="polite"></div>

          <form id="chatForm" class="chat-form">
            <label class="sr-only" for="chatInput">输入消息</label>
            <textarea id="chatInput" rows="3" placeholder="请输入对话"></textarea>
            <button id="sendChatBtn" type="submit" class="btn primary">发送</button>
          </form>
        </section>
        <!-- ... side panel ... -->
      </main>
    </div>
    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

Key: chatForm (id="chatForm"), chatInput (id="chatInput"), sendChatBtn (id="sendChatBtn")

### public/styles.css (317 lines)

Key rules:
- `.chat-form { display: grid; gap: 8px; }` — counter will sit inside this grid
- `--warning: #d97706` — warning color for counter
- `--muted: #667085` — default muted color for counter

### public/js/main.js (435 lines)

Key:
- `els` object: all DOM element references
- `els.chatInput` — the textarea to monitor
- Submit handler clears input: `els.chatInput.value = ''`
- Input event listener already exists (for command autocomplete)
- MAX_PROMPT_CHARS is backend-only; frontend uses hardcoded 8000

## Section 5 — Existing Tests

No tests exist for public/ frontend files (static assets, no backend logic).
Test suite: `node --test tests/**/*.test.js`

## Implementation Log

Files changed/created:
- `public/index.html` — added `<div class="char-counter"><span id="charCounter">0</span> / 8000</div>` inside `.chat-form`
- `public/styles.css` — added `.char-counter` (font-size: 12px, color: var(--muted), text-align: right) and `.char-counter.warning` (color: var(--warning))
- `public/js/main.js` — added `charCounter` to `els`, added `CHAR_LIMIT=8000`, `CHAR_WARN_THRESHOLD=6400`, `updateCharCounter()` function, called in `input` event and after submit clears input

Key decisions:
- Warning threshold = 80% of 8000 = 6400 chars (per acceptance criteria)
- Counter resets via `updateCharCounter()` call after `els.chatInput.value = ''` on submit
- CSS class management: `classList.toggle('warning', len >= CHAR_WARN_THRESHOLD)` on `.char-counter` wrapper div (parent of the span)
- No backend changes required — limit hardcoded to 8000 matching MAX_PROMPT_CHARS default
