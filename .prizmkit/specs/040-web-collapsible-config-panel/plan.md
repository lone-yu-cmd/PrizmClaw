# Plan — F-040: Web Collapsible Config Panel

## Key Components

- **HTML**: Replace `<section class="panel config-panel">` with `<details>/<summary>` pattern
- **CSS**: Style `details.config-panel` and `details.config-panel > summary` to match panel design

## Approach

Use native HTML `<details>`/`<summary>` elements — zero JS required, browser-native collapsing.
The `open` attribute on `<details>` makes it expanded by default.

## Files to Modify

- `public/index.html` — wrap config-panel content in `<details open>`/`<summary>`
- `public/styles.css` — add styles for `details.config-panel` and its summary element

## Data Flow

No data flow changes — purely presentational HTML/CSS.

## Tasks

- [x] Task 1: Update `public/index.html` — replace config-panel `<section>` with `<details open>`/`<summary>`
- [x] Task 2: Update `public/styles.css` — add collapsible panel styles (summary cursor, marker, padding)
- [x] Task 3: Verify acceptance criteria mentally and run test suite
