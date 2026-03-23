# Plan — F-032: Web Screenshot Preview Lightbox

## Key Components
- Lightbox overlay: full-screen semi-transparent backdrop
- Lightbox image: centered, original-size, scrollable if too large
- Open: click on `#screenshotImage` (only when not `.hidden`)
- Close: click backdrop or press Esc

## Files to Modify
- `public/index.html` — add `<div id="lightbox">` modal after `.app-shell`
- `public/styles.css` — add `#lightbox`, `#lightboxImg` styles + dark mode overrides
- `public/js/main.js` — add lightbox open/close handlers, Esc key integration

## Data Flow
1. Screenshot loads → `els.screenshotImage.classList.remove('hidden')` (existing)
2. User clicks `#screenshotImage` → JS opens lightbox, sets `#lightboxImg.src` to same data URL
3. User clicks backdrop or presses Esc → JS hides lightbox

## Design Decisions
- Lightbox is pure HTML+CSS+JS (no library) — consistent with existing lightweight approach
- `#screenshotImage` cursor becomes `pointer` via CSS `.screenshot-image:not(.hidden)` — avoids cursor on hidden state
- Lightbox `z-index: 100` — above `.app-header` z-index: 10 and command dropdown z-index: 100 (same layer, lightbox renders on top)
- Lightbox closes on Esc — must check lightbox state before propagating to command dropdown handler

## Tasks

- [x] Task 1: Add lightbox HTML to index.html
- [x] Task 2: Add lightbox CSS to styles.css (including dark mode)
- [x] Task 3: Add lightbox JS to main.js (open/close/Esc)
- [x] Task 4: Add cursor:pointer to screenshot-image when visible
