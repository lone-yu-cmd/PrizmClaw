# Plan: F-020 — Enhanced Terminal Output Streaming

## Architecture

### Components

1. **`src/utils/ansi-adapter.js`** (new)
   - Strip ANSI escape codes from raw terminal output
   - Convert basic ANSI colors to emoji markers (optional enhancement)
   - Collapse carriage-return (`\r`) progress lines — keep only the last complete state per line group

2. **`src/utils/output-segmenter.js`** (new)
   - Smart segmentation replacing hard-boundary `splitMessage()` for AI CLI output
   - Split at logical boundaries: code block fences (```), blank lines between paragraphs
   - Respect Telegram 4096-char limit (use 3800 as safe limit)
   - Never split inside a code block

3. **`src/services/output-history-service.js`** (new)
   - In-memory ring buffer per session — stores last N command outputs (default: 10)
   - Each entry: `{ prompt: string, output: string, timestamp: number, index: number }`
   - API: `addOutput(sessionKey, prompt, output)`, `getHistory(sessionKey, count)`, `clearHistory(sessionKey)`

4. **`src/bot/commands/handlers/output.js`** (new)
   - `/output [N]` command — show last N command outputs (default: 5, max: 20)
   - Format: numbered list with prompt + truncated output preview + timestamp
   - Uses `outputHistoryService` to retrieve entries

5. **`src/bot/telegram.js`** (modify)
   - Import and register `/output` command
   - Integrate `ansiAdapter.processChunk()` in the `onChunk` hook (strip ANSI before pushing to streamPublisher)
   - Replace `splitMessage()` call in streaming path with `outputSegmenter.segmentOutput()`
   - After each AI CLI reply, call `outputHistoryService.addOutput()` to record the output

### Data Flow

```
AI CLI stdout → onChunk(rawText)
                → ansiAdapter.processChunk(rawText)  # strip ANSI, collapse \r lines
                → streamPublisher.push(cleanText)     # stream to Telegram

AI CLI done → routerResult.reply (full output)
            → ansiAdapter.stripAll(reply)            # clean full output for history
            → outputHistoryService.addOutput(sessionKey, userMessage, cleanOutput)
            → outputSegmenter.segmentOutput(cleanText)  # for final display
            → streamPublisher.setFinalText(segmentedText)
```

### Interface Contracts

```js
// src/utils/ansi-adapter.js
export function stripAnsi(text: string): string          // Remove all ANSI escape codes
export function collapseCarriageReturns(text: string): string  // Collapse \r progress lines
export function processChunk(chunk: string): string       // stripAnsi + partial \r handling

// src/utils/output-segmenter.js
export function segmentOutput(text: string, maxChunkSize?: number): string[]  // Smart split
// Returns array of segments respecting code blocks and paragraphs

// src/services/output-history-service.js
export function createOutputHistoryService(maxEntries?: number): OutputHistoryService
export interface OutputHistoryService {
  addOutput(sessionKey: string, prompt: string, output: string): void
  getHistory(sessionKey: string, count: number): OutputEntry[]
  clearHistory(sessionKey: string): void
}

// src/bot/commands/handlers/output.js
export const outputMeta: CommandMeta
export async function handleOutput(handlerCtx: HandlerContext): Promise<void>
```

## Files to Create
- `src/utils/ansi-adapter.js`
- `src/utils/output-segmenter.js`
- `src/services/output-history-service.js`
- `src/bot/commands/handlers/output.js`
- `tests/utils/ansi-adapter.test.js`
- `tests/utils/output-segmenter.test.js`
- `tests/services/output-history-service.test.js`
- `tests/bot/commands/output.test.js`

## Files to Modify
- `src/bot/telegram.js` — register /output command, integrate ANSI adapter, smart segmentation, output history recording

## Testing Approach
- Unit tests: ansi-adapter, output-segmenter, output-history-service (isolated, no external deps)
- Unit test: /output handler (mock outputHistoryService)
- Integration: telegram.js text handler processes ANSI-free chunks (mock executeAiCli with ANSI output)

---

## Tasks

- [x] T1: Create `src/utils/ansi-adapter.js` with `stripAnsi`, `collapseCarriageReturns`, `processChunk`
- [x] T2: Write tests for `ansi-adapter.js` in `tests/utils/ansi-adapter.test.js`
- [x] T3: Create `src/utils/output-segmenter.js` with `segmentOutput`
- [x] T4: Write tests for `output-segmenter.js` in `tests/utils/output-segmenter.test.js`
- [x] T5: Create `src/services/output-history-service.js` with `createOutputHistoryService`
- [x] T6: Write tests for `output-history-service.js` in `tests/services/output-history-service.test.js`
- [x] T7: Create `/output` command handler in `src/bot/commands/handlers/output.js`
- [x] T8: Write tests for `/output` handler in `tests/bot/commands/output.test.js`
- [x] T9: Modify `src/bot/telegram.js` — integrate ANSI adapter in `onChunk`, smart segmentation in final display, output history recording, register `/output` command
