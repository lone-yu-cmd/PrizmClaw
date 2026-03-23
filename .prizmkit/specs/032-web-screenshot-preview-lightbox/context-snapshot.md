# Context Snapshot — F-032: Web Screenshot Preview Lightbox

## Section 1 — Feature Brief

**Description**: 为 Web 管理台截图预览图片（#screenshotImage）添加点击放大的 lightbox 效果。在 public/styles.css 和 public/index.html 中实现纯 CSS 或轻量 JS 的模态预览，用户点击截图后可查看原始尺寸图片。无后端变更。

**Acceptance Criteria**:
- Given 截图加载完成，When 用户点击截图预览图，Then 以 lightbox 模态框展示原始尺寸截图
- Given lightbox 已打开，When 用户点击模态框背景或按 Esc 键，Then 模态框关闭返回正常页面
- Given 截图尚未加载（.hidden 状态），When 渲染页面，Then 不显示 lightbox 触发元素

## Section 2 — Project Structure

Files to modify:
- public/index.html (88 lines) — add lightbox modal HTML, make screenshot image clickable
- public/styles.css (444 lines) — add lightbox overlay/modal CSS
- public/js/main.js (455 lines) — add lightbox open/close JS logic

## Section 3 — Prizm Context

From root.prizm:
- LANG: JavaScript (ESM), Node.js 22
- public module: static web panel assets — no L1 doc
- TEST_CMD: node --test tests/**/*.test.js
- Dark mode via @media (prefers-color-scheme: dark) — any new hardcoded colors need dark overrides
- .hidden uses display: none

## Section 4 — Existing Source Files

### public/index.html (88 lines)
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
            <div class="char-counter"><span id="charCounter">0</span> / 8000</div>
            <button id="sendChatBtn" type="submit" class="btn primary">发送</button>
          </form>
        </section>

        <section class="panel side-panel">
          <section class="sub-panel">
            <h2>一键截图</h2>
            <p class="hint">调用 <code>POST /api/screenshot</code> 并展示图片结果。</p>
            <button id="takeScreenshotBtn" type="button" class="btn primary">获取截图</button>
            <img id="screenshotImage" class="screenshot-image hidden" alt="截图预览" />
            <pre id="screenshotMeta" class="output-box"></pre>
          </section>

          <section class="sub-panel">
            <h2>系统命令</h2>
            <p class="hint">调用 <code>POST /api/system/exec</code>，展示 stdout/stderr/exit code。</p>
            <form id="execForm" class="exec-form">
              <label class="sr-only" for="execInput">输入系统命令</label>
              <input id="execInput" type="text" placeholder="例如：pwd" />
              <button id="runExecBtn" type="submit" class="btn warning">执行</button>
            </form>
            <div class="exec-result">
              <div>
                <h3>Exit Code</h3>
                <pre id="exitCodeOutput" class="output-box">-</pre>
              </div>
              <div>
                <h3>Stdout</h3>
                <pre id="stdoutOutput" class="output-box"></pre>
              </div>
              <div>
                <h3>Stderr</h3>
                <pre id="stderrOutput" class="output-box"></pre>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>

    <script type="module" src="./js/main.js"></script>
  </body>
</html>
```

### public/styles.css (444 lines)
Key styles relevant to lightbox implementation:
- `.hidden { display: none }` — screenshot img starts hidden
- `.screenshot-image` — width: 100%, border-radius: 10px, border, margin-top: 10px
- `z-index: 10` used by `.app-header` — lightbox overlay needs higher z-index
- Dark mode via `@media (prefers-color-scheme: dark)` — needs dark overlay override

### public/js/main.js (455 lines)
Key handlers:
- `els.screenshotImage` — element reference (line 25)
- Screenshot loaded handler (lines 395-413): sets `src`, removes `.hidden` class
- Esc key already handled (line 366) for command dropdown — lightbox Esc must not conflict

## Implementation Log
Files changed/created:
- public/index.html — added `<div id="lightbox">` with `<img id="lightboxImg">` before closing script tag
- public/styles.css — added `.screenshot-image:not(.hidden)`, `.lightbox`, `.lightbox.hidden`, `.lightbox-img` rules
- public/js/main.js — added `els.lightbox`, `els.lightboxImg` refs; `openLightbox()`, `closeLightbox()` functions; click handlers on screenshotImage and lightbox; global Esc keydown handler

Key decisions:
- Lightbox overlay `z-index: 200` (above header z-index: 10)
- `cursor: zoom-out` on backdrop, `cursor: default` on image to prevent closing when clicking image
- Esc handled via `document.addEventListener('keydown')` — separate from chatInput keydown so it works regardless of focus
- No dark mode CSS overrides needed — black backdrop (`rgba(0,0,0,0.8)`) works in both modes


No frontend tests exist. Backend tests use `node --test tests/**/*.test.js`. No test changes needed for pure frontend feature.
