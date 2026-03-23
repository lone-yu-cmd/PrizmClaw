# Plan — F-043: Web Font Size Accessibility Toggle

## Key Components

- **CSS**: Add `--font-scale` CSS var to `:root`, apply `font-size: calc(1rem * var(--font-scale))` to `body`, three size values: small=0.875, medium=1.0, large=1.2
- **HTML**: Add font-size toggle control (button group) to header area, three buttons: 小/中/大, with active state styling
- **JS**: Font size loading/saving to localStorage (separate key `prizmclaw-font-size`), apply scale to `document.documentElement`, wire button click handlers

## Data Flow

1. `init()` → `loadFontSize()` → reads localStorage → calls `applyFontSize(scale)` → sets CSS var on `<html>`
2. User clicks toggle button → `setFontSize(scale)` → saves to localStorage → `applyFontSize(scale)` → updates active button
3. On page reload → step 1 restores persisted scale

## Files to Modify

- `public/styles.css`: add `--font-scale: 1` to `:root`, `font-size: calc(1rem * var(--font-scale))` to `body`, `.font-toggle` button group styles
- `public/index.html`: add `<div class="font-toggle">` to header with 3 buttons
- `public/js/main.js`: add font toggle constants, `els.fontToggleBtns`, `applyFontSize()`, `loadFontSize()`, `setFontSize()`, wire click handlers in `init()`

## Tasks

- [x] T1: Add `--font-scale: 1` to `:root` in styles.css; add `font-size: calc(1rem * var(--font-scale))` to `body`; add `.font-toggle` button group CSS
- [x] T2: Add font toggle HTML (三个按钮 小/中/大) to `<header class="app-header">` in index.html
- [x] T3: Add JS constants `FONT_SIZE_KEY`, scales map; add `els.fontToggleBtns`; implement `applyFontSize()`, `loadFontSize()`, `setFontSize()`; wire handlers; call `loadFontSize()` in `init()`
