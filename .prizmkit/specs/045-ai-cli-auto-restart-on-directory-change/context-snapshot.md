## Section 1 — Feature Brief

**Feature**: F-045 — AI CLI Auto-Restart on Directory Change

**Description**: When the user switches the working directory via /cd, if the session has an active AI CLI process, automatically terminate it and restart AI CLI in the new directory. Ensures the AI CLI execution context stays consistent with the user's specified working directory. When no active process exists, maintain existing behavior (only update session cwd).

**Acceptance Criteria**:
1. Given session has active AI CLI process, When user executes /cd <path>, Then current AI CLI process is terminated and restarted in new directory
2. Given session has no active AI CLI process, When user executes /cd <path>, Then only update cwd, next AI CLI call uses new path
3. Given AI CLI restart completes, When user checks status, Then receives confirmation message with new working directory

## Section 2 — Project Structure

```
src/bot/commands/handlers/cd.js    — /cd command handler
src/services/ai-cli-service.js     — AI CLI execution, interrupt, process tracking
src/services/session-store.js      — Session state management (cwd, active process, etc.)
```

## Section 3 — Prizm Context

root.prizm: Node.js 22, ESM, Telegram→AI CLI bridge with web admin panel
- TEST_CMD: node --test tests/**/*.test.js
- All chat messages route through messageRouter.processMessage()
- Session keys: bound=telegram:{chatId}, unbound web=web:{sessionId}

## Section 4 — Existing Source Files

### src/bot/commands/handlers/cd.js (79 lines)
```javascript
import { access } from 'node:fs/promises';
import path from 'node:path';
import { sessionStore } from '../../../services/session-store.js';

export const cdMeta = {
  name: 'cd', aliases: [], description: '切换工作目录',
  usage: '/cd <路径>', examples: ['/cd /tmp', '/cd ~', '/cd ..'],
  params: [], requiresAuth: true, minRole: 'operator',
  helpText: '/cd <路径> - 切换工作目录（不带参数显示当前目录）'
};

export async function handleCd(handlerCtx) {
  const { reply, sessionId, args = [] } = handlerCtx;
  const targetPath = args[0];

  if (!targetPath) {
    const currentCwd = sessionStore.getCwd(sessionId) || process.cwd();
    await reply(`当前工作目录: ${currentCwd}`);
    return;
  }

  let resolvedPath = targetPath;
  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME || process.env.USERPROFILE || '', resolvedPath.slice(1));
  }
  if (!path.isAbsolute(resolvedPath)) {
    const currentCwd = sessionStore.getCwd(sessionId) || process.cwd();
    resolvedPath = path.resolve(currentCwd, resolvedPath);
  }
  resolvedPath = path.normalize(resolvedPath);

  try {
    await access(resolvedPath);
  } catch {
    await reply(`❌ 目录不存在或无法访问: ${resolvedPath}`);
    return;
  }

  sessionStore.setCwd(sessionId, resolvedPath);
  await reply(`✅ 工作目录已切换至: ${resolvedPath}`);
}
```

### src/services/ai-cli-service.js (566 lines)
Key exports:
- `executeAiCli(options)` — spawns AI CLI with session cwd, tracks process via sessionStore
- `interruptAiCli(sessionId)` — kills active process (SIGTERM → SIGKILL fallback)
- `isAiCliRunning(sessionId)` — checks if active process exists
- `getActiveProcessInfo(sessionId)` — returns pid, startedAt, stdoutBytes, userId

Process lifecycle: spawn → setActiveProcess → stdout/stderr collect → close → clearActiveProcess
The cwd is read from sessionStore.getCwd(sessionId) at spawn time (line 262).

### src/services/session-store.js (429 lines)
Key methods for this feature:
- `getCwd(sessionKey)` / `setCwd(sessionKey, cwd)` — working directory
- `getActiveProcess(sessionKey)` / `setActiveProcess(sessionKey, info)` / `clearActiveProcess(sessionKey)` — AI CLI process tracking
- Process info includes: pid, startedAt, childProcess, interrupted, timedOut, userId, stdoutBytes

## Section 5 — Existing Tests

### tests/bot/commands/handlers/cd.test.js (152 lines)
Tests: cdMeta export, update session cwd with valid dir, reply success message, reject invalid dir, show current dir when no path. Uses real sessionStore singleton. Test session IDs: test-session-cd-{1..4}.

## Implementation Log
Files changed/created:
- src/bot/commands/handlers/cd.js — added import of isAiCliRunning/restartAiCli; added auto-restart logic after setCwd
- src/services/ai-cli-service.js — added restartAiCli() function (kill + wait + re-execute)
- tests/bot/commands/handlers/cd-restart.test.js — new test file for F-045

Key decisions:
- restartAiCli sends a lightweight "session resumed" prompt (not replay of original user prompt) to avoid side effects
- Restart is fire-and-forget via executeAiCli().catch() — cd handler doesn't block on the new process completing
- Poll loop (100ms intervals, 10s max) waits for old process exit before spawning new one
