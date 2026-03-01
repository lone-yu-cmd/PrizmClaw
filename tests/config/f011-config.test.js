/**
 * Tests for F-011 AI CLI Proxy config additions
 * T-001: Add F-011 config fields to schema
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('F-011 AI CLI Config Variables', () => {
  describe('AI_CLI_HEARTBEAT_THRESHOLD_MS', () => {
    test('should default to 10000ms', async () => {
      const { config } = await import('../../src/config.js');
      assert.equal(config.aiCliHeartbeatThresholdMs, 10000);
    });

    test('should be a non-negative integer', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok(Number.isInteger(config.aiCliHeartbeatThresholdMs));
      assert.ok(config.aiCliHeartbeatThresholdMs >= 0);
    });
  });

  describe('AI_CLI_HEARTBEAT_INTERVAL_MS', () => {
    test('should default to 30000ms', async () => {
      const { config } = await import('../../src/config.js');
      assert.equal(config.aiCliHeartbeatIntervalMs, 30000);
    });

    test('should be a non-negative integer', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok(Number.isInteger(config.aiCliHeartbeatIntervalMs));
      assert.ok(config.aiCliHeartbeatIntervalMs >= 0);
    });
  });

  describe('AI_CLI_ENABLE_HEARTBEAT', () => {
    test('should default to true', async () => {
      const { config } = await import('../../src/config.js');
      assert.equal(config.aiCliEnableHeartbeat, true);
    });

    test('should be a boolean', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok(typeof config.aiCliEnableHeartbeat === 'boolean');
    });
  });

  describe('Config object structure', () => {
    test('should have all F-011 config properties', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok('aiCliHeartbeatThresholdMs' in config, 'aiCliHeartbeatThresholdMs should be in config');
      assert.ok('aiCliHeartbeatIntervalMs' in config, 'aiCliHeartbeatIntervalMs should be in config');
      assert.ok('aiCliEnableHeartbeat' in config, 'aiCliEnableHeartbeat should be in config');
    });
  });
});
