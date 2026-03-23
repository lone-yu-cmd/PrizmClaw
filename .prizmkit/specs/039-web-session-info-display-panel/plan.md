# Plan — F-039: Web Session Info Display Panel

## Key Components

- **Session Info Panel**: read-only card showing Session ID, connection state, Telegram Chat ID
- Placed between `config-panel` and `dashboard-grid` in `index.html`
- CSS uses only CSS vars (dark mode auto-switches without explicit override)
- JS: `updateSessionInfoPanel()` — reads `state.sessionId` and `state.telegramChatId`; called from `init()` and SSE events

## Data Flow

1. `init()` → sets `state.sessionId` → calls `updateSessionInfoPanel()`
2. SSE 'connected' event → update panel connection state row
3. SSE 'status' event → update panel connection state row
4. `els.sessionIdInput` change → update panel session ID row
5. `state.telegramChatId` — populated when SSE 'bind' event arrives (or null if unbound)

## Files to Modify

- `public/index.html`: add `<section id="sessionInfoPanel" class="panel session-info-panel">` with info rows
- `public/styles.css`: add `.session-info-panel`, `.info-row`, `.info-label`, `.info-value` styles
- `public/js/main.js`: add `state.telegramChatId`, `els.sessionInfoPanel*` refs, `updateSessionInfoPanel()`, call from init/SSE

## Tasks

- [ ] Task 1: Add session info panel HTML to index.html (after config-panel, before dashboard-grid)
- [ ] Task 2: Add CSS for .session-info-panel, .info-row, .info-label, .info-value to styles.css
- [ ] Task 3: Add JS — state.telegramChatId, els refs, updateSessionInfoPanel(), wire to init/SSE events
