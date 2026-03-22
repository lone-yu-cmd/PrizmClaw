# Context Snapshot — F-022: Web Chat Input Placeholder Update

## Section 1 — Feature Brief

**Description**: 将 Web 管理台聊天输入框的 placeholder 文本更新为「请输入对话」，提升界面可读性和用户引导性。修改范围限于 public/index.html 中 chatInput textarea 元素的 placeholder 属性，无后端变更。

**Acceptance Criteria**:
- Given 用户打开 Web 管理台, When 聊天输入框为空, Then 显示 placeholder 文字「请输入对话」
- Given 用户在输入框中输入内容, When 输入框非空, Then placeholder 文字不再显示
- Given 页面通过任意浏览器加载, When 渲染聊天输入框, Then placeholder 文字正确显示且无乱码

## Section 2 — Project Structure

- `public/index.html` — Web admin UI (87 lines)
- `public/styles.css` — Stylesheet
- `public/js/main.js` — Frontend JS module
- `src/` — Backend Node.js/Express source

## Section 3 — Prizm Context

root.prizm: PrizmClaw Node.js project, Express + Telegraf stack.
No L1/L2 docs needed — change is frontend HTML only, no backend or service changes.

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
            <textarea id="chatInput" rows="3" placeholder="输入消息，支持 Shift+Enter 换行"></textarea>
            <button id="sendChatBtn" type="submit" class="btn primary">发送</button>
          </form>
        </section>
        ...
      </main>
    </div>
    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

**Target**: Line 44 — `<textarea id="chatInput" rows="3" placeholder="输入消息，支持 Shift+Enter 换行">`
**Change**: Update placeholder to `请输入对话`

## Section 5 — Existing Tests

No tests exist for HTML placeholder values (frontend-only static attribute change).

## Implementation Log
Files changed/created: public/index.html
Key decisions: Single attribute change on textarea#chatInput, from「输入消息，支持 Shift+Enter 换行」to「请输入对话」. No backend, JS, or CSS changes needed. Pre-existing test failures (92) confirmed unrelated to this change.
