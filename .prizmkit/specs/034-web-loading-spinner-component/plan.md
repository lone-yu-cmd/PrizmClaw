# Plan — F-034: Web Loading Spinner Component

## Approach

CSS-only spinner using `@keyframes spin` + border trick. No new HTML elements needed — inject spinner as `::before` pseudo-element on `.btn.loading`. JS `setBusy()` adds/removes `.loading` class on the specific active button.

## Files to Modify

- `public/styles.css` — add spinner keyframe + `.btn.loading` styles
- `public/js/main.js` — update `setBusy()` to pass active button; add spinner class management

## Key Design Decisions

- Spinner as `::before` pseudo-element on button — no extra DOM elements needed
- `.btn.loading` adds spinner + hides text via `color: transparent` on button text; spinner stays visible via absolute positioning
- Each operation disables only its own button (not all buttons) to show which is loading
- `setBusy()` refactored to accept optional `activeBtn` parameter — when busy=true, adds `.loading` to activeBtn; when busy=false, removes `.loading` from all buttons

## Tasks

- [x] Task 1: Add CSS spinner animation and `.btn.loading` styles to `public/styles.css`
- [x] Task 2: Update `setBusy()` in `public/js/main.js` to accept activeBtn, manage `.loading` class
- [x] Task 3: Update call sites (chatForm, takeScreenshotBtn, execForm) to pass their button as activeBtn
