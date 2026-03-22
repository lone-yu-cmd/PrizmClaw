# Plan — F-025: Web Header Sticky Behavior

## Components
- `public/styles.css`: Add sticky positioning and separator to `.app-header`

## Data Flow / Approach
- `position: sticky; top: 0` on `.app-header` — browser handles sticky/normal flow automatically
- `background: var(--bg)` — header needs explicit background to cover content scrolling beneath it
- `border-bottom: 1px solid var(--line)` — static separator visible when header overlaps content
- `z-index: 10` — ensures header stays above panel content during scroll
- No JS needed — pure CSS feature

## Files to Modify
- `public/styles.css` — update `.app-header` rule (lines 36–41)

## Implementation Notes
- `.app-shell` has `padding: 20px` — header inherits left/right context but `top: 0` sticks to viewport top
- Since `.app-shell` has `max-width: 1200px; margin: 0 auto`, and `body` is the scroll container, `position: sticky` on `.app-header` will stick relative to the viewport as the body scrolls
- The separator (`border-bottom`) is always visible — this is simpler and more reliable than JS scroll listeners, and acceptable per AC-3 ("when rendering header bottom border" implies static rendering)

## Tasks

- [x] T1: Add sticky positioning, background, border-bottom, and z-index to `.app-header` in `public/styles.css`
