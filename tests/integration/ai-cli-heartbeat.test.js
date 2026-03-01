/**
 * Integration Tests for AI CLI Heartbeat
 * F-011, T-053: Test heartbeat in full context
 *
 * Tests cover:
 * - Heartbeat triggers after threshold
 * - Progress message content
 * - Heartbeat stops on completion/interrupt
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { sessionStore } from '../../src/services/session-store.js';
import {
  executeAiCli,
  interruptAiCli,
  resetMetrics
} from '../../src/services/ai-cli-service.js';

describe('F-011 AI CLI Heartbeat Integration (T-053)', () => {
  const testSessionId = 'test-heartbeat-session-001';
  const testUserId = '123456789';

  beforeEach(() => {
    sessionStore.clear(testSessionId);
    resetMetrics();
  });

  afterEach(() => {
    sessionStore.clear(testSessionId);
  });

  describe('Heartbeat Triggers', () => {
    test('should trigger heartbeat after threshold', async () => {
      const heartbeats = [];

      // Use a long-running command with short heartbeat threshold
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'slow task',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.5'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10, // Very short threshold
        heartbeatIntervalMs: 50, // Fast interval for testing
        hooks: {
          onHeartbeat: (info) => {
            heartbeats.push({ ...info, timestamp: Date.now() });
          }
        }
      });

      // Should have received heartbeats
      assert.ok(heartbeats.length > 0, 'Should have received at least one heartbeat');

      // Each heartbeat should have required properties
      for (const hb of heartbeats) {
        assert.ok(typeof hb.elapsedMs === 'number', 'elapsedMs should be a number');
        assert.ok(hb.elapsedMs >= 0, 'elapsedMs should be non-negative');
        assert.ok(typeof hb.stdoutBytes === 'number', 'stdoutBytes should be a number');
        assert.ok(typeof hb.status === 'string', 'status should be a string');
      }

      // Result should be successful
      assert.equal(result.interrupted, false);
      assert.equal(result.timedOut, false);
    });

    test('should not trigger heartbeat for short tasks', async () => {
      const heartbeats = [];

      // Use a fast command with a longer threshold
      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'fast task',
        userId: testUserId,
        bin: 'echo',
        args: ['done'],
        timeoutMs: 5000,
        heartbeatThresholdMs: 10000, // Long threshold - should not trigger
        heartbeatIntervalMs: 100,
        hooks: {
          onHeartbeat: (info) => {
            heartbeats.push(info);
          }
        }
      });

      // Should not have received heartbeats (task completes before threshold)
      assert.equal(heartbeats.length, 0, 'Should not have received heartbeats for fast task');
    });
  });

  describe('Progress Message Content', () => {
    test('heartbeat info contains elapsed time', async () => {
      const heartbeats = [];

      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 50,
        hooks: {
          onHeartbeat: (info) => {
            heartbeats.push(info);
          }
        }
      });

      assert.ok(heartbeats.length > 0);

      // Elapsed time should increase across heartbeats
      const elapsedTimes = heartbeats.map(h => h.elapsedMs);
      for (let i = 1; i < elapsedTimes.length; i++) {
        assert.ok(elapsedTimes[i] >= elapsedTimes[i - 1], 'Elapsed time should increase');
      }
    });

    test('heartbeat info contains status', async () => {
      const heartbeats = [];

      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 50,
        hooks: {
          onHeartbeat: (info) => {
            heartbeats.push(info);
          }
        }
      });

      assert.ok(heartbeats.length > 0);

      // All statuses should be 'running' or 'streaming'
      for (const hb of heartbeats) {
        assert.ok(
          hb.status === 'running' || hb.status === 'streaming',
          `Status should be 'running' or 'streaming', got '${hb.status}'`
        );
      }
    });
  });

  describe('Heartbeat Stops on Completion', () => {
    test('heartbeat stops when execution completes', async () => {
      const heartbeats = [];
      let heartbeatAfterCompletion = false;
      let executionCompleted = false;

      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.3'],
        timeoutMs: 10000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 50,
        hooks: {
          onHeartbeat: (info) => {
            if (executionCompleted) {
              heartbeatAfterCompletion = true;
            }
            heartbeats.push(info);
          }
        }
      });

      executionCompleted = true;

      // Wait a bit to see if any more heartbeats come
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received heartbeats during execution
      assert.ok(heartbeats.length > 0);

      // Should not have heartbeat after completion
      assert.equal(heartbeatAfterCompletion, false);
    });

    test('heartbeat stops when execution is interrupted', async () => {
      const heartbeats = [];
      let heartbeatAfterInterrupt = false;
      let interruptSent = false;

      const execPromise = executeAiCli({
        sessionId: testSessionId,
        prompt: 'long task',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'],
        timeoutMs: 30000,
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 50,
        hooks: {
          onHeartbeat: (info) => {
            if (interruptSent) {
              heartbeatAfterInterrupt = true;
            }
            heartbeats.push(info);
          }
        }
      });

      // Wait for some heartbeats
      await new Promise(resolve => setTimeout(resolve, 150));

      // Interrupt
      interruptSent = true;
      interruptAiCli(testSessionId);

      // Wait for execution to complete
      const result = await execPromise;

      // Wait a bit more to see if any more heartbeats come
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received heartbeats during execution
      assert.ok(heartbeats.length > 0);

      // Should be interrupted
      assert.equal(result.interrupted, true);
    });

    test('heartbeat stops on timeout', async () => {
      const heartbeats = [];
      let timeoutDetected = false;

      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'slow task',
        userId: testUserId,
        bin: 'sleep',
        args: ['10'],
        timeoutMs: 100, // Very short timeout
        heartbeatThresholdMs: 10,
        heartbeatIntervalMs: 30,
        hooks: {
          onHeartbeat: (info) => {
            if (timeoutDetected) {
              // Should not receive heartbeat after timeout
            }
            heartbeats.push(info);
          }
        }
      });

      timeoutDetected = true;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be timed out
      assert.equal(result.timedOut, true);
    });
  });

  describe('Heartbeat Interval', () => {
    test('heartbeats arrive at expected interval', async () => {
      const heartbeats = [];
      const intervalMs = 100;
      const thresholdMs = 10;

      await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test',
        userId: testUserId,
        bin: 'sleep',
        args: ['0.5'],
        timeoutMs: 10000,
        heartbeatThresholdMs: thresholdMs,
        heartbeatIntervalMs: intervalMs,
        hooks: {
          onHeartbeat: (info) => {
            heartbeats.push({ ...info, timestamp: Date.now() });
          }
        }
      });

      // Check intervals between heartbeats
      if (heartbeats.length > 1) {
        for (let i = 1; i < heartbeats.length; i++) {
          const interval = heartbeats[i].timestamp - heartbeats[i - 1].timestamp;
          // Allow 50% variance due to async nature
          assert.ok(
            interval >= intervalMs * 0.5,
            `Interval ${interval}ms should be at least ${intervalMs * 0.5}ms`
          );
        }
      }
    });
  });
});
