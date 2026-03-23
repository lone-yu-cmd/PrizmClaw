# Plan — F-030: Web Responsive Mobile Layout

## Key Components
- Single file change: `public/styles.css`
- Add `@media (max-width: 600px)` breakpoint after existing 900px breakpoint
- No HTML or JS changes needed

## Files to Modify
- `public/styles.css` — add mobile media query block

## Data Flow
CSS-only change; no data flow impact.

## Tasks

- [x] Add @media (max-width: 600px) block to public/styles.css with:
  - `.app-shell` padding reduced (20px → 12px) and gap reduced (16px → 10px)
  - `.app-header` wraps to column if needed — use flex-wrap:wrap and reduce gap
  - `.app-header h1` font-size reduced to prevent overflow
  - `.app-header .subtitle` hidden or truncated on very small screens (font-size: 12px)
  - `.status` max-width + text truncation (overflow:hidden, text-overflow:ellipsis, white-space:nowrap) to prevent overlap
  - `.panel` and `.sub-panel` padding reduced (14px → 10px)
  - `.chat-form` remains grid (already vertical stack), send button gets width:100%
  - `.exec-form` collapses to single column (grid-template-columns:1fr) with button full-width
  - `.chat-messages` max-height adjusted for mobile (50vh)
