# Plan — F-029: Web Output Box Syntax Highlight

## Key Components
- CSS-only change, no backend or JS modifications
- Modifier classes on .output-box for semantic states (stderr = error tone, exit code non-zero = warning/danger)
- JS applies modifier classes dynamically based on exec result values

## Files to Modify
- `public/styles.css` — add .output-box.error and .output-box.exit-error modifier classes
- `public/js/main.js` — apply modifier classes after exec result is set

## Data Flow
1. User runs exec command → API returns exitCode, stdout, stderr
2. JS sets textContent on each .output-box element
3. JS also applies CSS modifier class: stderrOutput gets .error if stderr non-empty, exitCodeOutput gets .exit-error if exitCode !== 0
4. CSS modifier classes style the box with appropriate color palette

## Design Decisions
- `.output-box.error` — uses existing error palette (#fef3f2 bg, #f9d3d0 border, var(--danger) color) consistent with .message.error and .status.error
- `.output-box.exit-error` — uses warning palette (--warning color, warning-toned bg) for non-zero exit codes
- Classes reset on each exec run (remove before re-applying)

## Tasks

- [x] Task 1: Add CSS modifier classes for .output-box.error and .output-box.exit-error in public/styles.css
- [x] Task 2: Update exec result handler in public/js/main.js to apply/remove modifier classes based on exitCode and stderr content
