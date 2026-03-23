# Context Snapshot — F-034: Web Loading Spinner Component

## Section 1 — Feature Brief

**Description**: 为 Web 管理台各异步操作（发送消息、截图、命令执行）添加 loading spinner 状态指示。在 public/styles.css 中实现 CSS 纯动画 spinner，按钮触发操作时显示 spinner 并禁用，操作完成后恢复。无后端变更。

**Acceptance Criteria**:
- Given 用户点击发送按钮，When 请求进行中，Then 按钮显示 spinner 动画并变为 disabled 状态
- Given 请求完成或失败，When 响应返回，Then spinner 消失，按钮恢复可点击状态
- Given spinner 动画，When 渲染，Then 动画流畅无抖动，不影响布局

**Dependencies**: F-023 Web Button Hover Animation (completed)

## Section 2 — Project Structure

Relevant files:
- `public/index.html` — Web panel HTML (95 lines)
- `public/styles.css` — CSS (558 lines) — all UI styling here
- `public/js/main.js` — Frontend JS (511 lines) — setBusy() manages button disabled state

## Section 3 — Prizm Context

**root.prizm**:
- Web panel z-index: header=10, command-dropdown=100, lightbox=200, toast=300
- CSS modifier pattern: modifier classes for state; dark mode overrides hardcoded light-palette
- Dark mode via @media (prefers-color-scheme: dark)
- public/ → no L1 doc (static web panel assets)
- TEST_CMD: node --test tests/**/*.test.js

## Section 4 — Existing Source Files

### public/index.html (95 lines)
```html
<!-- Key buttons -->
<button id="sendChatBtn" type="submit" class="btn primary">发送</button>
<button id="takeScreenshotBtn" type="button" class="btn primary">获取截图</button>
<button id="runExecBtn" type="submit" class="btn warning">执行</button>
```

### public/styles.css — key sections
```css
.btn {
  border: 0; border-radius: 10px; padding: 9px 14px; cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
/* Existing animations: fade-in (messages), toast-slide-in, toast-fade-out */
```

### public/js/main.js — key function
```js
function setBusy(busy, text) {
  state.busy = busy;
  els.sendChatBtn.disabled = busy;
  els.takeScreenshotBtn.disabled = busy;
  els.runExecBtn.disabled = busy;
  setStatus(text);
}
/* setBusy(true, '...') called in chatForm submit, takeScreenshotBtn click, execForm submit */
/* setBusy(false, '就绪') in finally blocks */
```

**Button text content in HTML** (direct text nodes, no child elements currently):
- `sendChatBtn`: "发送"
- `takeScreenshotBtn`: "获取截图"
- `runExecBtn`: "执行"

## Implementation Log
Files changed/created:
- `public/styles.css` — added `@keyframes btn-spin`, `.btn.loading`, `.btn.loading::before` styles
- `public/js/main.js` — updated `setBusy(busy, text, activeBtn=null)` signature; adds `.loading` to activeBtn on busy; removes from all buttons on idle; updated 3 call sites

Key decisions:
- Spinner via `::before` pseudo-element on `.btn.loading` — no extra DOM elements
- `color: transparent` on `.btn.loading` hides button text while spinner is visible
- Spinner uses `rgba(255,255,255,0.5)` track + `#fff` active arc — works for both `.btn.primary` and `.btn.warning` which both have white text
- `setBusy()` accepts optional `activeBtn` — shows spinner only on the triggering button; disables all three; backward-compatible (null default = no spinner shown)
- Pre-existing test failures (66): unrelated backend tests, not caused by this feature

No tests for frontend JS (no test files for public/).
Backend tests in tests/ use node --test.
