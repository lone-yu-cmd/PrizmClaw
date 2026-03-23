# Context Snapshot — F-031: Web Dark Mode Support

## Section 1 — Feature Brief

**Description**: Add dark mode support to the web admin panel. Override CSS variables via `@media (prefers-color-scheme: dark)` in `public/styles.css` so the UI automatically follows the OS dark theme. No toggle button needed. No backend changes.

**Acceptance Criteria**:
1. Given OS switches to dark mode, When loading/refreshing Web admin panel, Then UI auto-switches to dark color scheme
2. Given dark mode, When rendering all panels, inputs, buttons, Then component colors meet readability/contrast requirements
3. Given OS switches back to light mode, When loading/refreshing page, Then UI reverts to light color scheme

## Section 2 — Project Structure

```
public/
  index.html         # Web admin panel HTML (88 lines)
  styles.css         # All CSS styles (380 lines)
  js/
    main.js          # Frontend JavaScript
```

## Section 3 — Prizm Context

- No L1 doc for public/ (noted in root.prizm: "static web panel assets — no L1 doc")
- Relevant RULES from root.prizm:
  - `.panel` and `.sub-panel` are separate CSS rules (not grouped)
  - Shadow colors use `rgba(31, 38, 51, ...)` derived from `--text: #1f2633`
  - `.status` uses modifier classes `.connected` and `.error` with hardcoded colors
  - `.message.error` uses hardcoded `#fef3f2`, `#f9d3d0`
  - `.output-box.error` uses `#fef3f2`, `#f9d3d0`; `.output-box.exit-error` uses `#fffbf0`, `#fde8bb`
  - CSS breakpoints: 900px and 600px

## Section 4 — Existing Source Files

### public/styles.css (380 lines)

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

/* ... layout, components, animations, breakpoints ... */

/* Hardcoded colors that need dark overrides:
   - input, textarea, .chat-messages, .output-box: background: #fff
   - .screenshot-image: background: #fff
   - .status.connected: #ecfdf3, #a6f4c5, #027a48
   - .status.error: #fef3f2, #f9d3d0 (reuses var(--danger))
   - .message.error: #fef3f2, #f9d3d0 (reuses var(--danger))
   - .output-box.error: #fef3f2, #f9d3d0 (reuses var(--danger))
   - .output-box.exit-error: #fffbf0, #fde8bb (reuses var(--warning))
   - .btn.warning: color: #fff
*/
```

## Section 5 — Existing Tests

No tests exist for CSS/frontend files. This feature is purely CSS and can only be verified visually.

## Implementation Log

Files changed/created:
- `public/styles.css` — updated `color-scheme: light` to `light dark`; added `@media (prefers-color-scheme: dark)` block at end of file

Key decisions:
- Dark palette: `--bg: #111827`, `--panel: #1f2937`, `--line: #374151`, `--text: #f9fafb`, `--muted: #9ca3af`, `--primary: #5b8df8`, `--danger: #f87171`, `--warning: #f59e0b`, `--chat-user: #1e3a5f`, `--chat-assistant: #263144`
- Hardcoded `#fff` backgrounds (inputs, textarea, .chat-messages, .output-box, .screenshot-image) overridden to `var(--panel)` in dark media query
- Status/message modifier classes (.status.connected, .status.error, .message.error, .output-box.error, .output-box.exit-error) get dedicated dark overrides using deep red/amber dark palette
- Purely CSS solution — no JS toggle, no backend changes; reverts automatically when OS switches back to light
