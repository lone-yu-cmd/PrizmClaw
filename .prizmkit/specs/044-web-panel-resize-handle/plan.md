# Plan — F-044: Web Panel Resize Handle

## Key Components

- **Resize handle element**: `<div id="resizeHandle" class="resize-handle">` inserted between `.chat-panel` and `.side-panel` inside `.dashboard-grid`
- **CSS changes**: `.dashboard-grid` switches from fixed `grid-template-columns` to CSS var-driven columns; `.resize-handle` styles (cursor, visual indicator, hover state)
- **JS changes**: drag logic (mousedown/mousemove/mouseup), localStorage persist/restore, init integration

## Data Flow

1. Page loads → `loadColumnWidths()` reads `prizmclaw-column-widths` from localStorage → sets `--chat-col` / `--side-col` CSS vars on `.dashboard-grid`
2. User mousedown on `.resize-handle` → set `isDragging=true`, record `startX` and initial column widths
3. Mousemove → compute delta → clamp column widths (min 20%) → update CSS vars live
4. Mouseup → save to localStorage
5. Widths stored as percentages of `.dashboard-grid` total width

## Files to Modify

- `public/index.html`: add `<div id="resizeHandle" class="resize-handle">` between the two sections in `.dashboard-grid`
- `public/styles.css`: update `.dashboard-grid` to use CSS var columns; add `.resize-handle` styles
- `public/js/main.js`: add resize drag logic + localStorage persist/restore; call `loadColumnWidths()` in `init()`

## Tasks

- [x] T1: Add resize handle element in `public/index.html` (between `.chat-panel` and `.side-panel`)
- [x] T2: Update `.dashboard-grid` CSS to use CSS vars for column widths; add `.resize-handle` CSS styles
- [x] T3: Add drag logic and localStorage persistence in `public/js/main.js`; integrate with `init()`
