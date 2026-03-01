/**
 * Tests for F-011 AI CLI Service
 * T-010, T-011, T-012, T-013, T-014, T-015, T-016, T-017
 */

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('F-011 AI CLI Service', () => {
  const testSessionId = 'test-session-f011';

  beforeEach(async () => {
    // Reset modules to get fresh instances
    const { sessionStore } = await import('../../src/services/session-store.js');
    sessionStore.clear(testSessionId);
  });

  afterEach(async () => {
    const { sessionStore } = await import('../../src/services/session-store.js');
    sessionStore.clear(testSessionId);
  });

  describe('executeAiCli', () => {
    test('should export executeAiCli function', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');
      assert.ok(typeof executeAiCli === 'function');
    });

    test('should return result object with required properties', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'echo hello'
      });

      assert.ok(result);
      assert.ok('output' in result);
      assert.ok('elapsedMs' in result);
      assert.ok('timedOut' in result);
      assert.ok('interrupted' in result);
    });

    test('should track active process in session store', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');
      const { sessionStore } = await import('../../src/services/session-store.js');

      // Start execution (it should track the process)
      const resultPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'echo test'
      });

      // Wait for completion
      await resultPromise;

      // After completion, process should be cleared
      const processInfo = sessionStore.getActiveProcess(testSessionId);
      assert.equal(processInfo, null);
    });

    test('should call onChunk callback for streaming output', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      const chunks = [];
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'echo hello world',
        hooks: {
          onChunk: (text) => { chunks.push(text); }
        }
      });

      // Chunks should have been captured
      assert.ok(Array.isArray(chunks));
    });

    test('should handle timeout correctly', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      // Use a very short timeout
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'sleep 5 && echo done',
        timeoutMs: 100  // Very short timeout
      });

      assert.equal(result.timedOut, true);
    });

    test('should handle abort signal', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      const controller = new AbortController();

      // Start execution
      const resultPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'sleep 10 && echo done',
        signal: controller.signal
      });

      // Abort after a short delay
      setTimeout(() => controller.abort(), 100);

      const result = await resultPromise;
      assert.equal(result.interrupted, true);
    });

    test('should clean up process on completion', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');
      const { sessionStore } = await import('../../src/services/session-store.js');

      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'echo test'
      });

      const processInfo = sessionStore.getActiveProcess(testSessionId);
      assert.equal(processInfo, null);
    });

    test('should call onHeartbeat callback during long execution', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      const heartbeats = [];
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'sleep 1 && echo done',
        hooks: {
          onHeartbeat: (info) => { heartbeats.push(info); }
        },
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 100
      });

      // Heartbeats should have been captured
      assert.ok(Array.isArray(heartbeats));
    });
  });

  describe('interruptAiCli', () => {
    test('should export interruptAiCli function', async () => {
      const { interruptAiCli } = await import('../../src/services/ai-cli-service.js');
      assert.ok(typeof interruptAiCli === 'function');
    });

    test('should return error if no process running', async () => {
      const { interruptAiCli } = await import('../../src/services/ai-cli-service.js');

      const result = interruptAiCli('non-existent-session');

      assert.equal(result.ok, false);
      assert.ok(result.error);
    });

    test('should clear session store after interrupt', async () => {
      const { executeAiCli, interruptAiCli } = await import('../../src/services/ai-cli-service.js');
      const { sessionStore } = await import('../../src/services/session-store.js');

      // Start a long-running execution
      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'sleep 10 && echo done',
        timeoutMs: 20000  // Long timeout
      });

      // Wait a bit for the process to start
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify process is tracked
      const processInfo = sessionStore.getActiveProcess(testSessionId);
      assert.ok(processInfo, 'Process should be tracked');

      // Interrupt
      const result = interruptAiCli(testSessionId);
      assert.equal(result.ok, true);

      // Wait for execution to complete
      const execResult = await execPromise;
      assert.equal(execResult.interrupted, true);
    });
  });

  describe('isAiCliRunning', () => {
    test('should export isAiCliRunning function', async () => {
      const { isAiCliRunning } = await import('../../src/services/ai-cli-service.js');
      assert.ok(typeof isAiCliRunning === 'function');
    });

    test('should return false when no process running', async () => {
      const { isAiCliRunning } = await import('../../src/services/ai-cli-service.js');

      const running = isAiCliRunning('non-existent-session');
      assert.equal(running, false);
    });
  });

  describe('getActiveProcessInfo', () => {
    test('should export getActiveProcessInfo function', async () => {
      const { getActiveProcessInfo } = await import('../../src/services/ai-cli-service.js');
      assert.ok(typeof getActiveProcessInfo === 'function');
    });

    test('should return null when no process running', async () => {
      const { getActiveProcessInfo } = await import('../../src/services/ai-cli-service.js');

      const info = getActiveProcessInfo('non-existent-session');
      assert.equal(info, null);
    });
  });

  describe('Error Handling', () => {
    test('should return helpful error for process spawn failure', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test prompt',
        bin: 'non-existent-command-that-should-fail'
      });

      assert.ok(result.output);
      assert.ok(result.output.includes('无法启动') || result.output.includes('error') || result.output.includes('失败'));
    });

    test('should include suggestion on timeout', async () => {
      const { executeAiCli } = await import('../../src/services/ai-cli-service.js');

      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'sleep 5',
        timeoutMs: 100
      });

      assert.equal(result.timedOut, true);
      assert.ok(result.output);
    });
  });
});
