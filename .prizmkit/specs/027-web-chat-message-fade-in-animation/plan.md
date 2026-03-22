# Plan — F-027: Web Chat Message Fade-In Animation

## Overview
Add CSS fade-in animation to new chat messages in the web admin panel.
Pure CSS change — no backend or JS modifications needed.

## Key Components
- `@keyframes fade-in`: defines opacity 0→1 transition
- `.message` animation: applies the keyframe animation
- Acceptance criterion 3 (no animation on page load existing messages):
  CSS animations on `.message` fire when the element is inserted into the DOM.
  The welcome message (appended at `init()`) will also animate — this is acceptable
  per the spec which says "existing history messages" (pre-loaded from server state).
  Since this app loads no server-side message history on page load, criterion 3 is
  inherently satisfied — the welcome message is dynamically inserted and animating
  it is visually expected.

## Files to Modify
- `public/styles.css` — add `@keyframes fade-in` and `animation` property to `.message`

## Animation Design
- Duration: 0.25s (snappy, not distracting)
- Easing: `ease-out` (decelerates — natural for appearing elements)
- Fill mode: `both` (ensures opacity:0 before animation starts, opaque after)
- Keyframes: `from { opacity: 0; transform: translateY(4px); }` → `to { opacity: 1; transform: translateY(0); }`
- Small translateY adds subtle depth without being distracting

## Tasks
- [x] Add `@keyframes fade-in` definition to `public/styles.css`
- [x] Add `animation: fade-in 0.25s ease-out both` to `.message` rule
- [x] Run tests to confirm no regressions
