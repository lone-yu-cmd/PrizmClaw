# Plan — F-031: Web Dark Mode Support

## Summary
Add `@media (prefers-color-scheme: dark)` block to `public/styles.css` that overrides CSS variables and fixes hardcoded `#fff` colors. No JS, no backend changes.

## Files to Modify
- `public/styles.css` — add dark mode media query at end of file

## Key Components
1. **CSS variable overrides** — dark palette for all `:root` variables
2. **Hardcoded color fixes** — `input`, `textarea`, `.chat-messages`, `.output-box`, `.screenshot-image` use `background: #fff` (not var); must override in media query
3. **Status/message modifier classes** — `.status.connected`, `.status.error`, `.message.error`, `.output-box.error`, `.output-box.exit-error` use hardcoded palette values; provide dark-appropriate alternatives
4. **color-scheme declaration** — change `:root { color-scheme: light }` to also declare dark support

## Dark Palette Design
- `--bg`: `#111827` (dark navy)
- `--panel`: `#1f2937` (dark card)
- `--line`: `#374151` (subtle divider)
- `--text`: `#f9fafb` (light text)
- `--muted`: `#9ca3af` (muted text)
- `--primary`: `#5b8df8` (slightly lighter blue for contrast on dark)
- `--primary-contrast`: `#ffffff`
- `--warning`: `#f59e0b` (amber)
- `--danger`: `#f87171` (lighter red for readability on dark)
- `--chat-user`: `#1e3a5f` (dark blue tint)
- `--chat-assistant`: `#263144` (dark slate)
- White-bg overrides: `#1f2937` matching `--panel`

## Tasks
- [x] Add `@media (prefers-color-scheme: dark)` block with `:root` variable overrides
- [x] Override hardcoded `#fff` backgrounds in inputs, chat-messages, output-box, screenshot-image
- [x] Override hardcoded status/message modifier class colors for dark readability
- [x] Update `color-scheme` in `:root` to `light dark`
