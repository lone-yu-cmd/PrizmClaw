# Plan — F-035: Web Keyboard Shortcut Hints

## Key Components

**Component**: `.kbd` CSS class — styled to look like physical keyboard keys
**Files to modify**: `public/styles.css`, `public/index.html`
**No backend changes required**

## Data Flow

Static HTML: `.kbd` elements render inline next to buttons → CSS styles them as keyboard key badges

## Files to Create/Modify

- `public/styles.css` — add `.kbd` component styles + dark mode override
- `public/index.html` — add `<kbd class="kbd">` elements in chat-form and exec-form

## Design Decisions

- `.kbd` uses monospace font, rounded border, subtle background — matches existing design system
- Use `--muted` color palette to keep hints unobtrusive
- `.chat-form` hint wraps in `.chat-form-footer` div (flex row) containing send button + kbd hint
- `.exec-form` hint rendered in third grid cell spanning full width below input+button row
  - Alternative: place kbd inline after the exec button using flex wrapper
- Dark mode: `.kbd` uses CSS vars so auto-switches without explicit override needed

## Tasks

- [x] Task 1: Add `.kbd` CSS styles to `public/styles.css`
- [x] Task 2: Add `<kbd class="kbd">` hint in chat-form area of `public/index.html`
- [x] Task 3: Add `<kbd class="kbd">` hint in exec-form area of `public/index.html`
