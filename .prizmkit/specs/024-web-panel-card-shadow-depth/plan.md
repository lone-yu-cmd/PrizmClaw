# F-024: Web Panel Card Shadow Depth — Implementation Plan

## Overview

CSS-only enhancement to `public/styles.css`. Add `box-shadow` to `.panel` and `.sub-panel` selectors to create visual depth hierarchy against the `#f4f6fb` background.

## Design Decisions

- Background: `#f4f6fb` (light blue-gray), Panel: `#ffffff` (white)
- Use rgba shadow with low opacity — coordinates with cool-toned palette
- `.panel` gets a more pronounced outer shadow (card lifts from background)
- `.sub-panel` gets a lighter/subtler inner shadow (nested card, slightly less elevated)
- No media-query-specific shadow overrides needed — shadows are resolution-independent

## Shadow Values

- `.panel` box-shadow: `0 2px 8px rgba(31, 38, 51, 0.08), 0 1px 2px rgba(31, 38, 51, 0.04)`
  - Two-layer shadow: soft ambient (8px blur, 8% opacity) + tight contact (2px blur, 4% opacity)
  - Color: --text (#1f2633) converted to rgba for cool-tone coordination
- `.sub-panel` box-shadow: `0 1px 4px rgba(31, 38, 51, 0.06)`
  - Single-layer softer shadow — visually subordinate to parent .panel

## Files to Modify

- `public/styles.css` — add box-shadow to `.panel, .sub-panel` selector block

## Tasks

- [x] T1: Add box-shadow to `.panel` and `.sub-panel` in `public/styles.css`
- [x] T2: Verify acceptance criteria (visual inspection of CSS rules)
