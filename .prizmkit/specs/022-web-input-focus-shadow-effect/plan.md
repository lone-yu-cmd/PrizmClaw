# Plan — F-022: Web Input Focus Shadow Effect

## Overview
Pure CSS change to add focus shadow/glow effect to all input and textarea elements using the --primary color variable.

## Files to Modify
- `public/styles.css` — add focus styles after existing input/textarea block

## Key Components
- CSS `:focus` pseudo-class selector for `input` and `textarea`
- `outline: none` to remove native browser outline
- `box-shadow` using `--primary` color with alpha transparency for glow effect
- `border-color` change to reinforce focus state with primary color

## Data Flow
No backend changes. Pure CSS visual enhancement.

## Tasks

- [x] Add `input:focus, textarea:focus` CSS rules to `public/styles.css` with:
  - `outline: none` (removes native outline)
  - `border-color: var(--primary)` (primary color border on focus)
  - `box-shadow: 0 0 0 3px rgba(58, 111, 247, 0.18)` (glow effect)
