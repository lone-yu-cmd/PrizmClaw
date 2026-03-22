# Context Snapshot — F-025: Web Header Sticky Behavior

## Section 1 — Feature Brief

**Description**: Add sticky positioning to `.app-header` in `public/styles.css`. When page content overflows viewport height, the header stays fixed at top. A visual separator (border-bottom) appears when header is in sticky state. No backend changes.

**Acceptance Criteria**:
1. Given page content exceeds viewport height, When user scrolls down, Then header stays fixed at top and remains visible
2. Given header is in sticky state, When user scrolls back to top, Then header returns to normal document flow
3. Given header is fixed, When rendering header bottom border, Then a separator line is shown to distinguish header from content

## Section 2 — Project Structure

```
public/
  index.html      ← HTML structure, .app-header is <header class="app-header"> inside .app-shell
  styles.css      ← Target file for all CSS changes
  js/
```

**Key structural notes**:
- `.app-header` is a direct child of `.app-shell` (max-width: 1200px container with padding: 20px)
- `.app-shell` uses `display: grid; gap: 16px`
- `body { margin: 0; background: var(--bg); }`
- `position: sticky` works on `.app-header` because `.app-shell` is the scroll container ancestor

## Section 3 — Prizm Context

**root.prizm key rules**:
- `.btn:disabled` uses `pointer-events: none` (F-023)
- `.panel` and `.sub-panel` are separate CSS rules with different box-shadow depths (F-024)
- Shadow colors use `rgba(31, 38, 51, ...)` derived from `--text: #1f2633`

**Design tokens**:
- `--bg: #f4f6fb`
- `--panel: #ffffff`
- `--line: #dfe3ef`
- `--text: #1f2633`

## Section 4 — Existing Source Files

### public/styles.css (287 lines)

```css
:root {
  color-scheme: light;
  --bg: #f4f6fb;
  --panel: #ffffff;
  --line: #dfe3ef;
  --text: #1f2633;
  --muted: #667085;
  --primary: #3a6ff7;
  --primary-contrast: #ffffff;
  --warning: #d97706;
  --danger: #b42318;
  --chat-user: #e9f0ff;
  --chat-assistant: #f5f7fa;
  --radius: 12px;
}

/* ... */

.app-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  display: grid;
  gap: 16px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
```

**Current `.app-header` state**: No sticky positioning, no border-bottom, no background.

### public/index.html (87 lines)

```html
<div class="app-shell">
  <header class="app-header">
    <div>
      <h1>PrizmClaw 管理台</h1>
      <p class="subtitle">聊天、截图、系统命令执行</p>
    </div>
    <div id="status" class="status" role="status" aria-live="polite">就绪</div>
  </header>
  <!-- ... panels ... -->
</div>
```

## Section 5 — Existing Tests

No tests for CSS/HTML (pure frontend styling — no JS behavior tested). Test command: `node --test tests/**/*.test.js`

## Implementation Log
Files changed/created:
- `public/styles.css` — updated `.app-header` rule: added `position: sticky`, `top: 0`, `z-index: 10`, `background: var(--bg)`, `border-bottom: 1px solid var(--line)`, `padding-bottom: 12px`, `margin-bottom: -12px`

Key decisions:
- Used `position: sticky` (not `fixed`) so header participates in normal document flow when at page top
- Added `background: var(--bg)` to prevent content from showing through header during scroll
- Added `padding-bottom` + negative `margin-bottom` to offset the border-bottom from affecting grid gap spacing
- `z-index: 10` ensures header overlays panel cards during scroll
- No JS needed — pure CSS handles all three acceptance criteria
