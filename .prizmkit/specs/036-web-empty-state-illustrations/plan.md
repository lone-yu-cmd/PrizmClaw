# Plan — F-036: Web Empty State Illustrations

## Key Components

- `.empty-state` CSS component: centered icon + text, uses CSS vars only (auto dark mode)
- Chat empty state: rendered inside `#chatMessages` in HTML; hidden once real messages appear
- Exec empty state: rendered inside `.exec-result` in HTML; hidden once exec runs
- JS logic: hide/show empty states when content changes

## Files to Modify

- `public/index.html` — add `.empty-state` elements inside chat + exec areas
- `public/styles.css` — add `.empty-state` component styles
- `public/js/main.js` — add `updateChatEmptyState()` + `updateExecEmptyState()` helpers; wire to existing appendMessage, clearChatBtn, and execForm submit handlers

## Data Flow

1. Page load: empty states visible, no content → criteria 1 & 2
2. appendMessage() called → updateChatEmptyState() hides chat empty state → criteria 3
3. execForm submit succeeds → updateExecEmptyState() hides exec empty state → criteria 3
4. clearChatBtn clicked → chatMessages.innerHTML = '' → appendMessage('system',...) → updateChatEmptyState() re-evaluates → empty state stays hidden (system message is content)

## Tasks

- [ ] T1: Add `.empty-state` CSS component to `public/styles.css`
- [ ] T2: Add empty state HTML elements to `public/index.html` (chat + exec areas)
- [ ] T3: Add JS logic to `public/js/main.js` to show/hide empty states
