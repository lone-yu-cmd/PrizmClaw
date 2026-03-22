# Context Snapshot — F-026: Web Status Indicator Color States

## Section 1 — Feature Brief

**Description**: 为 Web 管理台状态指示器（#status）添加多种颜色状态（就绪/连接中/错误）的视觉区分。在 public/styles.css 中新增 .status.connected、.status.error 样式类，通过不同背景色和文字色传达连接状态。

**Acceptance Criteria**:
- Given 连接就绪状态, When 渲染状态指示器, Then 显示默认中性样式
- Given 连接成功状态, When JS 为元素添加 .connected 类, Then 指示器显示绿色调样式
- Given 连接错误状态, When JS 为元素添加 .error 类, Then 指示器显示红色调样式

## Section 2 — Project Structure

public/
  index.html       — Web admin panel HTML
  styles.css       — All CSS (293 lines)
  js/main.js       — Frontend JS with SSE event handling and status updates

## Section 3 — Prizm Context

root.prizm notes:
- public -> (static web panel assets — no L1 doc)
- .panel and .sub-panel are separate CSS rules (not grouped) — different box-shadow depths
- shadow colors use rgba derived from --text (#1f2633) for cool-tone palette coordination
- .btn:disabled uses pointer-events: none to prevent hover CSS from firing
- .app-header: position: sticky + background: var(--bg) + z-index: 10

Design tokens from :root:
- --bg: #f4f6fb
- --panel: #ffffff
- --line: #dfe3ef
- --text: #1f2633
- --muted: #667085
- --primary: #3a6ff7
- --warning: #d97706
- --danger: #b42318

## Section 4 — Existing Source Files

### public/styles.css (293 lines, excerpt of .status rule at line 62)

```css
.status {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--muted);
}
```

### public/js/main.js (status-related lines)

```js
// Elements
const els = {
  status: document.getElementById('status'),
  ...
};

function setStatus(text) {
  els.status.textContent = text;
}

// SSE events:
es.addEventListener('connected', () => {
  setStatus('实时通道已连接');  // No class change currently
});

es.addEventListener('status', (event) => {
  if (payload.stage === 'running') {
    setStatus('助手处理中...');  // No class change currently
    return;
  }
  if (payload.stage === 'accepted') {
    setStatus('已接收请求');
    return;
  }
  setStatus('实时通道在线');
});

es.addEventListener('assistant_done', (event) => {
  setStatus('就绪');  // default ready state
});

es.onerror = () => {
  setStatus('实时通道重连中...');  // error/reconnecting state
};
```

### public/index.html (status element at line 16)

```html
<div id="status" class="status" role="status" aria-live="polite">就绪</div>
```

## Section 5 — Existing Tests

No tests for CSS/frontend UI. Tests are in tests/ directory and cover backend JS only.

## Implementation Log

Files changed/created:
- `public/styles.css` — added `.status.connected` and `.status.error` modifier rules after `.status` base rule
- `public/js/main.js` — extended `setStatus(text, state)` to manage CSS classes; wired 'connected' and SSE online to 'connected' state, `onerror` to 'error' state

Key decisions:
- `.status.connected` and `.status.error` are modifier classes, not standalone — they override only color properties while base `.status` keeps layout/sizing
- Green palette (#ecfdf3 bg, #a6f4c5 border, #027a48 text) matches Tailwind green-50/green-200/green-800 tone for legibility
- Error palette reuses `.message.error` values (#fef3f2, #f9d3d0, var(--danger)) for visual system consistency
- `setStatus()` signature extended with optional `state` param — null/undefined = no class added (default neutral)
- 'running' and 'accepted' SSE stages get no color state (neutral) — only 'connected'/'online' and error conditions get color
