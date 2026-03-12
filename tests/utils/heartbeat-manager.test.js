/**
 * Tests for F-011 heartbeat manager utility
 * T-004: Create heartbeat manager utility
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-011 Heartbeat Manager', () => {
  describe('startHeartbeat', () => {
    test('should return a stop function', async () => {
      const { startHeartbeat } = await import('../../src/utils/heartbeat-manager.js');

      const stop = startHeartbeat({
        callback: () => {},
        intervalMs: 1000,
        thresholdMs: 0
      });

      assert.ok(typeof stop === 'function');
      stop();
    });

    test('should call callback after threshold and interval', async () => {
      const { startHeartbeat } = await import('../../src/utils/heartbeat-manager.js');

      let callCount = 0;
      const stop = startHeartbeat({
        callback: () => { callCount++; },
        intervalMs: 50,
        thresholdMs: 0
      });

      // Wait for at least one heartbeat
      await new Promise(resolve => setTimeout(resolve, 80));

      stop();
      assert.ok(callCount >= 1, `Expected at least 1 callback, got ${callCount}`);
    });

    test('should NOT call callback before threshold', async () => {
      const { startHeartbeat } = await import('../../src/utils/heartbeat-manager.js');

      let callCount = 0;
      const stop = startHeartbeat({
        callback: () => { callCount++; },
        intervalMs: 50,
        thresholdMs: 200
      });

      // Wait less than threshold
      await new Promise(resolve => setTimeout(resolve, 100));

      stop();
      assert.equal(callCount, 0, `Expected 0 callbacks before threshold, got ${callCount}`);
    });

    test('should call callback after threshold elapsed', async () => {
      const { startHeartbeat } = await import('../../src/utils/heartbeat-manager.js');

      let callCount = 0;
      const stop = startHeartbeat({
        callback: () => { callCount++; },
        intervalMs: 50,
        thresholdMs: 30
      });

      // Wait for threshold + one interval
      await new Promise(resolve => setTimeout(resolve, 100));

      stop();
      assert.ok(callCount >= 1, `Expected at least 1 callback after threshold, got ${callCount}`);
    });

    test('should stop calling after stop() is called', async () => {
      const { startHeartbeat } = await import('../../src/utils/heartbeat-manager.js');

      let callCount = 0;
      const stop = startHeartbeat({
        callback: () => { callCount++; },
        intervalMs: 30,
        thresholdMs: 0
      });

      // Wait for some heartbeats
      await new Promise(resolve => setTimeout(resolve, 80));
      stop();

      const countAfterStop = callCount;

      // Wait more time
      await new Promise(resolve => setTimeout(resolve, 80));

      // Should not have more calls
      assert.equal(callCount, countAfterStop, 'Callback should not be called after stop()');
    });

    test('should pass elapsed time to callback', async () => {
      const { startHeartbeat } = await import('../../src/utils/heartbeat-manager.js');

      let capturedElapsed = null;
      const stop = startHeartbeat({
        callback: (info) => { capturedElapsed = info.elapsedMs; },
        intervalMs: 50,
        thresholdMs: 0
      });

      await new Promise(resolve => setTimeout(resolve, 70));

      stop();
      assert.ok(capturedElapsed !== null, 'Should have captured elapsed time');
      assert.ok(capturedElapsed >= 0, 'Elapsed time should be non-negative');
    });
  });

  describe('createHeartbeatManager', () => {
    test('should create a manager with start and stop methods', async () => {
      const { createHeartbeatManager } = await import('../../src/utils/heartbeat-manager.js');

      const manager = createHeartbeatManager();

      assert.ok(typeof manager.start === 'function');
      assert.ok(typeof manager.stop === 'function');
      assert.ok(typeof manager.isRunning === 'function');
    });

    test('isRunning should reflect heartbeat state', async () => {
      const { createHeartbeatManager } = await import('../../src/utils/heartbeat-manager.js');

      const manager = createHeartbeatManager();

      assert.equal(manager.isRunning(), false);

      manager.start({
        callback: () => {},
        intervalMs: 100,
        thresholdMs: 0
      });

      assert.equal(manager.isRunning(), true);

      manager.stop();

      assert.equal(manager.isRunning(), false);
    });

    test('stop should be idempotent', async () => {
      const { createHeartbeatManager } = await import('../../src/utils/heartbeat-manager.js');

      const manager = createHeartbeatManager();

      manager.start({
        callback: () => {},
        intervalMs: 100,
        thresholdMs: 0
      });

      manager.stop();
      manager.stop(); // Should not throw

      assert.equal(manager.isRunning(), false);
    });
  });
});
