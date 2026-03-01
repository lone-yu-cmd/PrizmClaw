/**
 * Tests for F-017 Runtime Config integration in main config module
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';

describe('F-017 Runtime Config Integration', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.LOG_LEVEL = 'info';
    process.env.REQUEST_TIMEOUT_MS = '120000';
    process.env.AI_CLI_HEARTBEAT_MS = '30000';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  test('should export runtimeConfig service via main config object', () => {
    assert.ok(config.runtimeConfig, 'runtimeConfig should be exported');
    assert.ok(typeof config.runtimeConfig.getAllConfig === 'function', 'getAllConfig method should be available');
    assert.ok(typeof config.runtimeConfig.getConfig === 'function', 'getConfig method should be available');
    assert.ok(typeof config.runtimeConfig.setConfig === 'function', 'setConfig method should be available');
    assert.ok(typeof config.runtimeConfig.resetConfig === 'function', 'resetConfig method should be available');
  });

  test('should allow accessing runtime config methods through main config', async () => {
    const allConfig = await config.runtimeConfig.getAllConfig();
    assert.ok(allConfig.LOG_LEVEL);
    assert.ok(allConfig.REQUEST_TIMEOUT_MS);
  });

  test('should support runtime config modification through main config', async () => {
    const result = await config.runtimeConfig.setConfig('LOG_LEVEL', 'debug');
    assert.ok(result.success);
    assert.equal(result.newValue, 'debug');

    // Verify the change took effect
    const currentValue = await config.runtimeConfig.getConfig('LOG_LEVEL');
    assert.equal(currentValue, 'debug');
  });

  test('should support config reset through main config', async () => {
    // First change the value
    await config.runtimeConfig.setConfig('LOG_LEVEL', 'debug');

    // Then reset it
    const result = await config.runtimeConfig.resetConfig('LOG_LEVEL');
    assert.ok(result.success);
    assert.equal(result.newValue, 'info');

    // Verify reset
    const currentValue = await config.runtimeConfig.getConfig('LOG_LEVEL');
    assert.equal(currentValue, 'info');
  });

  test('should maintain config object immutability', () => {
    // Config object should still be frozen
    assert.throws(() => {
      config.newProperty = 'test';
    }, /Cannot add property/);

    // But runtimeConfig methods should work
    assert.ok(config.runtimeConfig);
  });

  test('should have access to safe config keys list', async () => {
    const safeKeys = await config.runtimeConfig.getSafeConfigKeys();
    assert.ok(Array.isArray(safeKeys));
    assert.ok(safeKeys.includes('LOG_LEVEL'));
    assert.ok(safeKeys.includes('REQUEST_TIMEOUT_MS'));
  });

  test('should have access to sensitive config keys list', async () => {
    const sensitiveKeys = await config.runtimeConfig.getSensitiveConfigKeys();
    assert.ok(Array.isArray(sensitiveKeys));
    assert.ok(sensitiveKeys.includes('TELEGRAM_BOT_TOKEN'));
    assert.ok(sensitiveKeys.includes('CODEBUDDY_BIN'));
  });
});