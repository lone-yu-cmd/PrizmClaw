# Plan — F-023: Web Button Hover Animation

## Overview
Add hover transition animations to all `.btn` elements in `public/styles.css`.
Pure CSS change. No backend, no JS, no tests required.

## Files to Modify
- `public/styles.css` — add `transition` to `.btn`, add `.btn:hover` state, ensure `.btn:disabled:hover` has no animation

## Key Design Decisions
- Use `transition` on `.btn` for smooth enter/leave
- Use `transform: translateY(-1px)` for subtle lift effect on hover
- Use `filter: brightness(1.08)` for visual feedback on hover
- Disabled buttons: override hover via `:disabled` selector (pointer-events: none + no transform)

## Tasks

- [x] Add `transition` property to `.btn` base rule
- [x] Add `.btn:hover` rule with `transform` and `filter`
- [x] Ensure `.btn:disabled` overrides hover (pointer-events: none)
