# Context Snapshot — F-022: Web Input Focus Shadow Effect

## Section 1 — Feature Brief

**Description**: 为 Web 管理台所有输入框（textarea、input）添加聚焦时的阴影视觉反馈。在 public/styles.css 中为 input:focus 和 textarea:focus 添加 box-shadow 与 outline 样式，使用 --primary 色调，提升交互可感知性和界面一致性。无后端变更。

**Acceptance Criteria**:
1. Given 用户点击或 Tab 聚焦到任意输入框，When 输入框获得焦点，Then 输入框显示基于 --primary 色的可见阴影光晕效果
2. Given 输入框处于聚焦状态，When 用户点击其他区域失焦，Then 阴影效果消失并恢复默认边框样式
3. Given 所有浏览器渲染，When 渲染聚焦输入框，Then 原生 outline 被移除，由自定义 box-shadow 替代，无双重轮廓

## Section 2 — Project Structure

- public/styles.css — main stylesheet with CSS custom properties
- public/index.html — web admin console with input/textarea elements
- public/js/main.js — frontend JS

## Section 3 — Prizm Context

Root.prizm key info:
- PROJECT: PrizmClaw
- LANG: nodejs
- No CSS-specific module doc needed (pure frontend CSS change)

CSS Variables in :root:
- --primary: #3a6ff7
- --line: #dfe3ef

## Section 4 — Existing Source Files

### public/styles.css (265 lines)

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

/* ... existing styles ... */

input,
textarea {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 9px 10px;
  width: 100%;
  color: inherit;
  background: #fff;
}
/* No focus styles currently */
```

## Implementation Log
Files changed/created:
- public/styles.css — added `input:focus, textarea:focus` block after line 103

Key decisions:
- Used `rgba(58, 111, 247, 0.18)` (hardcoded alpha of --primary) for box-shadow since CSS custom properties can't be used directly in rgba() without color-mix or CSS Color Level 4
- `outline: none` ensures no double-outline in any browser
- `border-color: var(--primary)` reinforces focus state visually with primary color
