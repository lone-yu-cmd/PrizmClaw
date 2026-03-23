# F-038: Web Copy To Clipboard Button — Plan

## Approach

Wrap each `.output-box` in a `.output-box-wrapper` (position: relative) and add a copy icon button
(`.copy-btn`) absolutely positioned at the top-right corner. Clicking invokes `navigator.clipboard.writeText()`
and shows a toast via `showToast()`.

## Files to Modify

- `public/index.html` — wrap each output-box in `.output-box-wrapper`, add `.copy-btn` sibling
- `public/styles.css` — add `.output-box-wrapper` and `.copy-btn` styles
- `public/js/main.js` — add `copyToClipboard(el)` helper, bind click handlers

## Data Flow

User clicks `.copy-btn` → `copyToClipboard(outputBoxEl)` → reads `.textContent.trim()` →
- empty: `showToast('内容为空', 'info')`
- non-empty: `navigator.clipboard.writeText(text)` → `showToast('已复制', 'success')`

## Key Design Decisions

- `.output-box-wrapper` uses `position: relative` so `.copy-btn` can use `position: absolute; top: 6px; right: 6px`
- `.copy-btn` uses only CSS vars (auto dark mode) — same pattern as `.kbd` and `.scroll-to-bottom`
- Copy icon: Unicode clipboard symbol `⧉` or `📋` — use `⎘` (U+2398, HELM SYMBOL looks like copy) or simple `⧉`; use `⎗` or just "复制" text with icon; use SVG inline or plain text `Copy` — use simple Unicode `⧉` for brevity
- Button is always visible (not hidden when empty) — when clicked on empty box, shows '内容为空' toast
- `navigator.clipboard` API is modern; no fallback needed (admin tool context)

## Tasks

- [ ] T1: Modify `public/index.html` — wrap each output-box in `.output-box-wrapper` div, add `.copy-btn` button
- [ ] T2: Add CSS to `public/styles.css` — `.output-box-wrapper` and `.copy-btn` styles (position, hover, dark auto)
- [ ] T3: Add JS to `public/js/main.js` — `copyToClipboard(el)` helper + bind event listeners
