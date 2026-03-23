# Plan — F-033: Web Toast Notification System

## Components
- `#toast-container`: fixed-position div in HTML, bottom-right corner
- `.toast`: individual toast element with type modifier classes
- `showToast(msg, type)`: JS function — creates toast, appends to container, auto-removes after 3s with fade-out animation

## Data Flow
1. Caller invokes `showToast(msg, 'success'|'error'|'info')`
2. Creates `.toast.{type}` div with message text
3. Appends to `#toast-container`
4. After 3s: adds `.toast-fade-out` class → CSS animation plays → removes from DOM

## Files to Modify
- `public/index.html`: add `<div id="toast-container">` before `</body>`
- `public/styles.css`: add `.toast-container`, `.toast`, `.toast.success/error/info`, `@keyframes toast-fade-out`, dark mode overrides
- `public/js/main.js`: add `toastContainer` to `els`, implement `showToast()`, call it in chat/screenshot/exec handlers

## Tasks
- [x] Task 1: Add #toast-container to index.html (before </body>, after lightbox div)
- [x] Task 2: Add toast CSS to styles.css (container, toast base, type variants, fade-out animation, dark overrides)
- [x] Task 3: Add showToast() function and toastContainer el ref to main.js
- [x] Task 4: Wire showToast() calls to existing success/error paths in chat/screenshot/exec handlers
