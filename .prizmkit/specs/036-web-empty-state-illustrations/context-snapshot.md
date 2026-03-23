# Context Snapshot — F-036: Web Empty State Illustrations

## Section 1 — Feature Brief

**Description**: 为 Web 管理台聊天消息区和命令输出区的空状态添加引导文案和图标。在 public/styles.css 和 public/index.html 中实现 .empty-state 组件，当列表为空时居中展示提示图标与说明文字。无后端变更。

**Acceptance Criteria**:
1. Given 聊天消息区无消息，When 渲染页面，Then 显示空状态提示（图标+文字），引导用户发送第一条消息
2. Given 命令输出区无内容，When 渲染页面，Then 显示空状态提示，引导用户执行命令
3. Given 用户发送消息或执行命令后，When 内容出现，Then 空状态提示自动隐藏

## Section 2 — Project Structure

Files to modify:
- public/index.html (100 lines)
- public/styles.css (611 lines)
- public/js/main.js (518 lines)

## Section 3 — Prizm Context

PROJECT: PrizmClaw — Telegram → AI CLI bridge with web admin panel
LANG: JavaScript (ESM), Node.js 22
CSS pattern: modifier classes for state, CSS vars for dark mode auto-switching
Z-index hierarchy: .app-header=10, command-dropdown=100, lightbox=200, toast=300
Dark mode: @media (prefers-color-scheme: dark); hardcoded #fff backgrounds need explicit dark overrides

Key CSS vars used: --bg, --panel, --line, --text, --muted, --primary, --radius

## Section 4 — Existing Source Files

### public/index.html (100 lines)
- #chatMessages: empty div, aria-live="polite" — chat messages go here
- #stdoutOutput, #stderrOutput: pre.output-box elements — exec output goes here
- init() in main.js appends a system message on load
- clearChatBtn clears chatMessages and appends a system message

### public/styles.css (611 lines)
Key rules:
- .chat-messages: border, border-radius, padding, min-height:360px, max-height:62vh, overflow:auto, display:grid, gap:10px, background:#fff
- .output-box: margin:0, border, border-radius, padding, min-height:44px, background:#fff, white-space:pre-wrap
- .message: padding, border-radius, line-height, white-space, word-break, animation:fade-in
- CSS vars: --muted (#667085 light, #9ca3af dark), --panel, --line, --text
- Dark mode overrides: .chat-messages background → var(--panel), .output-box background → var(--panel)

### public/js/main.js (518 lines)
Key functions:
- init(): appends welcome system message → chatMessages will never be truly empty on load
- appendMessage(role, text): appends to chatMessages, scrolls to bottom
- clearChatBtn listener: clears chatMessages.innerHTML, then appends system message

IMPORTANT: Because init() always calls appendMessage('system', '...'), chatMessages is NEVER empty after page load. The empty state for chat must:
- Be placed INSIDE #chatMessages as a placeholder that gets hidden when real messages appear, OR
- Be shown only when chatMessages has zero *non-empty-state* children

For exec output area: stdoutOutput/stderrOutput are pre.output-box elements. The empty state should appear above them or inside a wrapper when no command has been run yet (outputs are empty/"-").

## Section 5 — Existing Tests

No frontend tests — this is CSS/HTML only, no Jest tests needed. Test by verifying acceptance criteria manually (or via visual inspection logic).

## Implementation Log
Files changed/created:
- public/styles.css — added .empty-state, .empty-state-icon, .empty-state-title, .empty-state-hint component; added #execOutput grid rule
- public/index.html — added #chatEmptyState inside #chatMessages; wrapped exec output in #execOutput with #execEmptyState sibling
- public/js/main.js — added chatEmptyState/execEmptyState/execOutput to els; added updateChatEmptyState() (hides only when .message.user/.message.assistant present); added updateExecEmptyState(hasResult); wired into appendMessage(), clearChatBtn listener, execForm submit handler

Key decisions:
- updateChatEmptyState() only checks .message.user/.message.assistant so welcome system message does not hide the empty state
- clearChatBtn re-appends chatEmptyState DOM element after innerHTML='' to restore it
- execOutput wrapper (#execOutput) added to group the three output boxes; shown/hidden as a unit by updateExecEmptyState()
- .empty-state uses only CSS vars (--muted, --text) so dark mode auto-switches without explicit override
