# Plan — F-037: Web Scroll To Bottom Button

## Key Components
- Floating button `#scrollToBottomBtn` positioned absolute inside `.chat-panel` (relative container)
- Scroll listener on `#chatMessages` to show/hide button when scrolled > 100px from bottom
- Click handler: smooth scroll to bottom

## Data Flow
1. User scrolls up in chatMessages → scroll event → check if scrollTop < scrollHeight - clientHeight - 100 → show button
2. User clicks button → chatMessages.scrollTo({ top: scrollHeight, behavior: 'smooth' })
3. appendMessage() already calls scrollTop = scrollHeight → hides button naturally

## Files to Modify
- `public/index.html`: add `#scrollToBottomBtn` button inside `.chat-panel` section, after `#chatMessages`
- `public/styles.css`: add `.scroll-to-bottom` styles (position absolute, z-index 50, hidden by default, show when `.visible`)
- `public/js/main.js`: add `els.scrollToBottomBtn`, scroll listener, click handler, `updateScrollToBottomBtn()` helper

## Architecture Decision
- Position button as `position: absolute` inside `.chat-panel` which gets `position: relative`
- Button anchors to bottom-right of chat panel area (near chatMessages)
- z-index: 50 — above normal content, below command dropdown (100)
- Button uses existing `.btn` base style + circular shape override
- Only CSS vars used for colors → dark mode auto-switches

## Tasks
- [ ] Task 1: Add `#scrollToBottomBtn` button to index.html inside chat-panel
- [ ] Task 2: Add `.scroll-to-bottom` CSS styles to styles.css
- [ ] Task 3: Wire scroll detection and click handler in main.js
