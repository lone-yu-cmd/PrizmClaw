# Plan — F-026: Web Status Indicator Color States

## Overview
Add visual color states to the `#status` element in the web admin panel.
Three states: default (neutral/ready), connected (green), error (red).

## Files to Modify
- `public/styles.css` — add `.status.connected` and `.status.error` CSS rules
- `public/js/main.js` — update `setStatus()` to manage CSS classes for state

## Design Decisions
- Colors derived from existing palette: green tone for connected, red tone for error
- Use `--danger: #b42318` family for error (consistent with `.message.error`)
- No new CSS variables — use inline rgba values consistent with palette approach
- `setStatus()` extended to accept optional state parameter ('connected' | 'error' | null)
- Class swap pattern: remove both classes, then add the appropriate one

## CSS Color Values
- `.status.connected`: background `#ecfdf3`, border `#a6f4c5`, color `#027a48` (green)
- `.status.error`: background `#fef3f2`, border `#f9d3d0`, color `var(--danger)` (red, reuses existing message.error palette)

## Tasks

- [ ] Task 1: Add `.status.connected` and `.status.error` CSS rules to `public/styles.css`
- [ ] Task 2: Update `setStatus()` in `public/js/main.js` to accept and apply state classes
- [ ] Task 3: Wire state classes to SSE events (connected → 'connected', onerror → 'error', done → null)
