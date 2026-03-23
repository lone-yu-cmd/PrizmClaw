# F-038 Context Snapshot: Web Copy To Clipboard Button

## Section 1 — Feature Brief

**Feature**: Add one-click copy buttons to all `.output-box` elements in the web admin panel.

**Acceptance Criteria**:
- Given 输出框有内容, When 渲染, Then 右上角显示复制按钮图标
- Given 复制按钮可见, When 用户点击, Then 框内文本写入剪贴板并显示「已复制」toast 提示
- Given 输出框为空, When 渲染, Then 复制按钮显示但点击时提示「内容为空」

**Affected output boxes** (4 total):
- `#screenshotMeta` (screenshot panel)
- `#exitCodeOutput` (exec: exit code)
- `#stdoutOutput` (exec: stdout)
- `#stderrOutput` (exec: stderr)

## Section 2 — Project Structure

Frontend-only feature. No backend changes needed.
- `public/index.html` — HTML structure
- `public/styles.css` — CSS styles
- `public/js/main.js` — JavaScript logic

## Section 3 — Prizm Context

Root rules relevant to this feature:
- Web panel CSS z-index hierarchy: .app-header=10, command-dropdown=100, lightbox=200, toast=300
- Toast: showToast(msg, type) in public/js/main.js; type='success'|'error'|'info'
- CSS modifier pattern: use modifier classes for state; dark mode overrides hardcoded light-palette values
- Empty/kbd/scroll CSS uses only CSS vars so dark mode auto-switches without explicit override

## Section 4 — Existing Source Files

### public/index.html (116 lines)

Output boxes in the HTML:
1. `<pre id="screenshotMeta" class="output-box"></pre>` — in screenshot sub-panel
2. `<pre id="exitCodeOutput" class="output-box">-</pre>` — in exec output
3. `<pre id="stdoutOutput" class="output-box"></pre>` — in exec output
4. `<pre id="stderrOutput" class="output-box"></pre>` — in exec output

Pattern for wrapping each output box:
Each output box sits inside a `<div>` with an `<h3>` sibling (except screenshotMeta which is a direct child of sub-panel).

### public/styles.css (690 lines)

`.output-box` base styles: border, border-radius: 10px, padding: 10px, min-height: 44px, background #fff.
`.output-box.error` and `.output-box.exit-error` are state modifiers.
Dark mode overrides `.output-box` background to `var(--panel)`.

### public/js/main.js (549 lines)

Key patterns:
- `showToast(msg, type)` — global toast function
- `els` object holds all DOM references
- Output boxes referenced as: `els.screenshotMeta`, `els.exitCodeOutput`, `els.stdoutOutput`, `els.stderrOutput`
- `.textContent` is used to set output box content

## Implementation Log

Files changed/created:
- `public/index.html` — wrapped 4 output-box elements in `.output-box-wrapper` div; added `.copy-btn` button with `data-target` attribute pointing to output box ID
- `public/styles.css` — added `.output-box-wrapper` (position: relative) and `.copy-btn` (absolute top-right, CSS vars only for dark mode auto-switch)
- `public/js/main.js` — added `copyToClipboard(el)` async helper + delegated `document.click` listener for `.copy-btn`

Key decisions:
- CSS vars only in `.copy-btn` → dark mode auto-switches without explicit `@media` override (same pattern as `.kbd`, `.empty-state`, `.scroll-to-bottom`)
- Delegated event listener on `document` for `.copy-btn` → works for dynamically created elements and avoids binding 4 separate listeners
- `data-target` attribute holds the ID of the corresponding output box → decoupled HTML/JS binding
- Empty check: `text === '-'` handles exitCodeOutput initial state; `.trim()` handles whitespace-only content


No frontend tests (Jest tests are for backend only). Acceptance criteria validated manually.
