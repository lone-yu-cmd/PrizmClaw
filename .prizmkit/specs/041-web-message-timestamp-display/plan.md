# Plan — F-041: Web Message Timestamp Display

## Key Components

- `formatTimestamp()` — returns current time as "HH:MM" string
- `.message-timestamp` span — appended inside `.message` element at bottom-right
- CSS `.message-timestamp` — small font, --muted color, right-aligned, no layout disruption

## Data Flow

1. `createMessageElement()` calls `formatTimestamp()` → creates `<span class="message-timestamp">HH:MM</span>`
2. Timestamp span appended to message item after role + body
3. CSS positions timestamp at bottom-right of message using flex layout on `.message`

## Files to Modify

- `public/js/main.js` — add `formatTimestamp()`, modify `createMessageElement()` to append timestamp span
- `public/styles.css` — add `.message-timestamp` styles + adjust `.message` layout

## Architecture Notes

- `.message` needs `display: flex; flex-direction: column` (currently block with white-space:pre-wrap)
- Timestamp uses only CSS vars (--muted) → dark mode auto-switches without explicit override
- Body must preserve `white-space: pre-wrap; word-break: break-word` behavior

## Tasks

- [ ] T1: Add `.message-timestamp` CSS styles in public/styles.css; adjust `.message` to support timestamp layout
- [ ] T2: Add `formatTimestamp()` function in public/js/main.js; modify `createMessageElement()` to append timestamp span
