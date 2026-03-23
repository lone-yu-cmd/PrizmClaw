# Plan — F-028: Web Input Character Counter

## Key Components

- **Counter element**: `<span id="charCounter">` placed inside `.chat-form` below textarea
- **Character limit**: 8000 (matching MAX_PROMPT_CHARS backend default)
- **Warning threshold**: 80% of 8000 = 6400 chars
- **Warning state**: Add/remove `.warning` CSS class on counter element

## Data Flow

1. User types in `#chatInput` textarea
2. `input` event fires → update `#charCounter` textContent to `length / 8000`
3. If `length >= 6400`: add `.warning` class → counter turns `--warning` color
4. On submit: input cleared → reset counter to `0 / 8000` in default style

## Files to Modify

| File | Change |
|------|--------|
| `public/index.html` | Add `<div class="char-counter"><span id="charCounter">0</span> / 8000</div>` inside `.chat-form` |
| `public/styles.css` | Add `.char-counter` layout rule + `.char-counter.warning` color rule |
| `public/js/main.js` | Add `charCounter` to `els`, add counter update logic in `input` event, reset on submit |

## Tasks

- [ ] T1: Add counter HTML element to `public/index.html` inside `.chat-form`
- [ ] T2: Add `.char-counter` and `.char-counter.warning` CSS rules to `public/styles.css`
- [ ] T3: Wire counter logic in `public/js/main.js` (els ref + input handler + submit reset)
