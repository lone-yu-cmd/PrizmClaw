# F-045: AI CLI Auto-Restart on Directory Change

## Overview
When /cd changes the working directory and an AI CLI process is active, automatically kill and restart it in the new directory.

## Key Components
- **cd handler** (`src/bot/commands/handlers/cd.js`): After setCwd, check for active process → kill → restart
- **ai-cli-service** (`src/services/ai-cli-service.js`): Already exposes `interruptAiCli()` and `isAiCliRunning()` — sufficient for kill; need a `restartAiCli()` function for restart

## Data Flow
1. User sends `/cd /new/path`
2. cd handler validates path, calls `sessionStore.setCwd(sessionId, resolvedPath)`
3. cd handler checks `isAiCliRunning(sessionId)`
4. If running: call `interruptAiCli(sessionId)`, wait for process to exit, then call `executeAiCli()` with a system prompt in new cwd
5. Reply with confirmation including restart info

## Design Decisions
- **No auto-restart with full user prompt**: We can't replay the original user prompt (it may have side effects). Instead, restart with a lightweight "session resumed" prompt so the AI CLI is ready in the new directory.
- **Wait for kill before restart**: Use a polling loop on `isAiCliRunning()` to ensure the old process is dead before spawning new one.
- **Non-blocking restart**: The restart runs in the background — cd handler sends confirmation immediately, then kicks off restart. Reply with restart status via additional message.

## Files Modified
- `src/bot/commands/handlers/cd.js` — add auto-restart logic after setCwd
- `src/services/ai-cli-service.js` — add `restartAiCli(sessionId)` helper
- `tests/bot/commands/handlers/cd.test.js` — add F-045 test cases

## Tasks

- [x] T1: Add `restartAiCli(sessionId)` to ai-cli-service.js — kills active process, waits for exit, spawns new AI CLI in current cwd
- [x] T2: Update cd handler to detect active process and trigger restart after setCwd
- [x] T3: Write tests for F-045 auto-restart behavior (active process → restart, no process → no restart, restart confirmation message)
