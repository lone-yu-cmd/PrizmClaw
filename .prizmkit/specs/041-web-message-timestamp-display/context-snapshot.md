# Context Snapshot — F-041: Web Message Timestamp Display

## Section 1 — Feature Brief

**Description**: 为 Web 管理台聊天消息添加发送时间戳显示。在 public/styles.css 和 public/js/main.js 中为每条消息附加本地时间标签（HH:MM 格式），以小字体显示在消息角落，提升对话可追溯性。无后端变更。

**Acceptance Criteria**:
1. Given 用户发送消息，When 消息渲染到聊天区，Then 消息右下角显示发送时间（HH:MM 格式）
2. Given AI 回复消息，When 消息渲染到聊天区，Then 消息右下角显示接收时间
3. Given 时间戳文字，When 渲染，Then 以小号字体和 --muted 颜色显示，不干扰消息主体阅读

**Dependencies**: F-027 (Web Chat Message Fade-In Animation) — completed

## Section 2 — Project Structure

- public/js/main.js — web panel JavaScript (607 lines)
- public/styles.css — web panel CSS (824 lines)
- No backend changes required

## Section 3 — Prizm Context

PROJECT: PrizmClaw
LANG: JavaScript (ESM), Node.js 22
TEST_CMD: node --test tests/**/*.test.js
- public -> (static web panel assets — no L1 doc)
RULES relevant to this feature:
- Web panel CSS modifier pattern: modifier classes for state
- Dark mode via @media (prefers-color-scheme: dark) in styles.css
- CSS vars only in new components → dark mode auto-switches without explicit override

## Section 4 — Existing Source Files

### public/js/main.js (607 lines, key functions)

`createMessageElement(role, text, isError, isHtml)` at line 170:
```js
function createMessageElement(role, text, isError = false, isHtml = false) {
  const item = document.createElement('div');
  item.className = `message ${role} ${isError ? 'error' : ''}`.trim();

  const roleEl = document.createElement('span');
  roleEl.className = 'role';
  roleEl.textContent = role === 'user' ? '你' : role === 'assistant' ? '助手' : '系统';

  const body = document.createElement('div');
  body.className = 'body';
  if (isHtml) {
    body.innerHTML = text;
  } else {
    body.textContent = text;
  }

  item.append(roleEl, body);
  return { item, body };
}
```

`appendMessage(role, text, isError, isHtml)` at line 190:
```js
function appendMessage(role, text, isError = false, isHtml = false) {
  const node = createMessageElement(role, text, isError, isHtml);
  els.chatMessages.appendChild(node.item);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  updateChatEmptyState();
  return node;
}
```

### public/styles.css (824 lines, relevant sections)

`.message` base styles at line 335:
```css
.message {
  padding: 10px;
  border-radius: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  animation: fade-in 0.25s ease-out both;
}
```

`.message .role` at line 358:
```css
.message .role {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}
```

CSS vars: --muted: #667085 (light) / #9ca3af (dark), auto-switch via :root dark override

## Section 5 — Existing Tests

No existing tests for web panel JS (frontend-only, no test files found for main.js/styles.css).

## Implementation Log

Files changed/created:
- `public/styles.css` — modified `.message` to use flex-column layout; added `.message .body` (preserves white-space:pre-wrap); added `.message-timestamp` (11px, var(--muted), text-align:right, margin-top:4px)
- `public/js/main.js` — added `formatTimestamp()` (returns HH:MM local time); modified `createMessageElement()` to append `<span class="message-timestamp">` after body

Key decisions:
- `.message` changed from block to flex-column to allow timestamp to naturally sit at bottom-right via text-align:right
- `.message .body` extracted as explicit class to restore white-space:pre-wrap on the body div only (parent flex doesn't need it)
- `.message-timestamp` uses only CSS vars (--muted) → dark mode auto-switches without explicit `@media (prefers-color-scheme: dark)` override block (same pattern as .kbd, .empty-state, .scroll-to-bottom)
- `formatTimestamp()` uses `new Date()` at call time (moment of rendering) — captures accurate send/receive time
