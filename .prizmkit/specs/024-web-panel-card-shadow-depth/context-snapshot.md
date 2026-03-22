# Context Snapshot — F-024: Web Panel Card Shadow Depth

## Section 1 — Feature Brief

**Description**: 为 Web 管理台各 panel 卡片添加层次感阴影。在 public/styles.css 中为 .panel 和 .sub-panel 添加 box-shadow，区分卡片与背景层次，提升视觉深度。无后端变更。

**Acceptance Criteria**:
- Given 页面加载完成，When 渲染 panel 卡片，Then 卡片显示与背景有层次感的阴影效果
- Given 页面在不同分辨率下渲染，When 查看 panel，Then 阴影在各断点下均正确显示
- Given 深色背景与浅色面板，When 查看卡片阴影，Then 阴影颜色与整体配色协调

**Scope**: CSS-only change to `public/styles.css`. No backend changes.

## Section 2 — Project Structure

```
public/
  styles.css     ← target file
  index.html     ← uses .panel and .sub-panel classes
  js/
    main.js
src/             ← not relevant to this feature
```

**Color palette** (from :root):
- --bg: #f4f6fb  (light blue-gray background)
- --panel: #ffffff (white panel background)
- --line: #dfe3ef (light blue-gray border)
- --text: #1f2633
- --muted: #667085
- --primary: #3a6ff7

## Section 3 — Prizm Context

**root.prizm highlights**:
- Platform: Claude Code, passive adoption mode
- No L1 doc for `public/` module — static assets

**Relevant L1**: None (public/ has no prizm doc)

**Rules from root.prizm**:
- `.btn:disabled` uses `pointer-events: none` (F-023 pattern)
- Hover effects use `transform` + `filter` with `transition` (F-023 pattern)

## Section 4 — Existing Source Files

### public/styles.css (279 lines)

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

.panel,
.sub-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
}
/* NO box-shadow currently */

/* ... media queries unchanged ... */
```

**Key finding**: `.panel, .sub-panel` at lines 64–70 has no `box-shadow`.
Background is `#f4f6fb` (light blue-gray). Panel is `#ffffff` (white).
Shadow must be subtle to coordinate with this light theme.

### public/index.html (87 lines)

Uses of `.panel`:
- `<section class="panel config-panel">` — connection settings panel
- `<section class="panel chat-panel">` — chat panel (main left column)
- `<section class="panel side-panel">` — right side container

Uses of `.sub-panel`:
- `<section class="sub-panel">` — screenshot card (inside side-panel)
- `<section class="sub-panel">` — system command card (inside side-panel)

**Note**: `.sub-panel` is nested inside `.panel` (side-panel). The shadow depth should be
hierarchical: `.panel` shadow should be more prominent, `.sub-panel` shadow lighter/inner.

## Section 5 — Existing Tests

No CSS tests exist. This feature is CSS-only and does not require test changes.
Acceptance criteria will be verified by visual inspection of CSS rules.

## Implementation Log
Files changed/created:
- public/styles.css: Split .panel and .sub-panel into separate selectors, added box-shadow to each

Key decisions:
- Separated the grouped .panel,.sub-panel selector to allow different shadow depths per level
- .panel gets two-layer shadow (ambient + contact) for more visual lift from page background
- .sub-panel gets single lighter shadow — visually subordinate as nested card within .panel side-panel
- Shadow color rgba(31,38,51,...) derived from --text (#1f2633) to coordinate with cool-toned palette
- No media query shadow overrides needed — box-shadow is resolution-independent
