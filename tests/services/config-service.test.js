/**
 * Tests for F-017 Runtime Config Service
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { configService } from '../../src/services/config-service.js';

describe('F-017 Config Service', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.LOG_LEVEL = 'info';
    process.env.REQUEST_TIMEOUT_MS = '120000';
    process.env.AI_CLI_HEARTBEAT_MS = '30000';
    process.env.MAX_PROMPT_CHARS = '8000';
    process.env.MAX_HISTORY_TURNS = '10';
    process.env.SYSTEM_MONITOR_INTERVAL_MS = '60000';
    process.env.SESSION_TIMEOUT_MS = '1800000';
    process.env.TASK_DEBOUNCE_MS = '500';
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-12345';
    process.env.CODEBUDDY_BIN = 'codebuddy';
    process.env.WEB_HOST = '0.0.0.0';
    process.env.WEB_PORT = '8787';
    process.env.ENABLE_TELEGRAM = 'true';
    process.env.USER_PERMISSIONS = '';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('getAllConfig', () => {
    test('should return all config values with sensitive fields masked', async () => {
      const result = await configService.getAllConfig();

      assert.ok(result.LOG_LEVEL);
      assert.ok(result.REQUEST_TIMEOUT_MS);
      assert.ok(result.AI_CLI_HEARTBEAT_MS);

      // Sensitive fields should be masked
      assert.equal(result.TELEGRAM_BOT_TOKEN, '***');
      assert.equal(result.CODEBUDDY_BIN, '***');
      assert.equal(result.WEB_HOST, '***');
      assert.equal(result.WEB_PORT, '***');
    });

    test('should include all config keys from schema', async () => {
      const result = await configService.getAllConfig();

      // Check that major config categories are present
      assert.ok('LOG_LEVEL' in result);
      assert.ok('REQUEST_TIMEOUT_MS' in result);
      assert.ok('ENABLE_TELEGRAM' in result);
      assert.ok('CODEBUDDY_BIN' in result);
      assert.ok('USER_PERMISSIONS' in result);
    });
  });

  describe('getConfig', () => {
    test('should return specific config value', async () => {
      const result = await configService.getConfig('LOG_LEVEL');
      assert.equal(result, 'info');
    });

    test('should mask sensitive config values', async () => {
      const result = await configService.getConfig('TELEGRAM_BOT_TOKEN');
      assert.equal(result, '***');
    });

    test('should return null for unknown config key', async () => {
      const result = await configService.getConfig('UNKNOWN_KEY');
      assert.equal(result, null);
    });

    test('should handle case-insensitive keys', async () => {
      const result1 = await configService.getConfig('log_level');
      const result2 = await configService.getConfig('LOG_LEVEL');
      assert.equal(result1, result2);
    });
  });

  describe('setConfig', () => {
    test('should allow setting safe config values', async () => {
      const result = await configService.setConfig('LOG_LEVEL', 'debug');
      assert.ok(result.success);
      assert.equal(result.newValue, 'debug');

      // Verify the change took effect
      const currentValue = await configService.getConfig('LOG_LEVEL');
      assert.equal(currentValue, 'debug');
    });

    test('should validate config values against schema', async () => {
      const result = await configService.setConfig('LOG_LEVEL', 'invalid-level');
      assert.ok(!result.success);
      assert.ok(result.error.includes('验证失败'));
    });

    test('should reject setting sensitive config keys', async () => {
      const result = await configService.setConfig('TELEGRAM_BOT_TOKEN', 'new-token');
      assert.ok(!result.success);
      assert.ok(result.error.includes('不允许修改'));
    });

    test('should reject unknown config keys', async () => {
      const result = await configService.setConfig('UNKNOWN_KEY', 'value');
      assert.ok(!result.success);
      assert.ok(result.error.includes('未知的配置项'));
    });

    test('should handle numeric conversion for number configs', async () => {
      const result = await configService.setConfig('REQUEST_TIMEOUT_MS', '150000');
      assert.ok(result.success);
      assert.equal(result.newValue, 150000);
    });
  });

  describe('resetConfig', () => {
    test('should reset config to original env value', async () => {
      // First change the value
      await configService.setConfig('LOG_LEVEL', 'debug');

      // Then reset it
      const result = await configService.resetConfig('LOG_LEVEL');
      assert.ok(result.success);
      assert.equal(result.newValue, 'info');

      // Verify reset
      const currentValue = await configService.getConfig('LOG_LEVEL');
      assert.equal(currentValue, 'info');
    });

    test('should reject reset for sensitive config keys', async () => {
      const result = await configService.resetConfig('TELEGRAM_BOT_TOKEN');
      assert.ok(!result.success);
      assert.ok(result.error.includes('不允许修改'));
    });

    test('should reject reset for unknown config keys', async () => {
      const result = await configService.resetConfig('UNKNOWN_KEY');
      assert.ok(!result.success);
      assert.ok(result.error.includes('未知的配置项'));
    });
  });

  describe('isSafeConfigKey', () => {
    test('should return true for safe config keys', async () => {
      assert.ok(await configService.isSafeConfigKey('LOG_LEVEL'));
      assert.ok(await configService.isSafeConfigKey('REQUEST_TIMEOUT_MS'));
      assert.ok(await configService.isSafeConfigKey('AI_CLI_HEARTBEAT_MS'));
    });

    test('should return false for sensitive config keys', async () => {
      assert.ok(!await configService.isSafeConfigKey('TELEGRAM_BOT_TOKEN'));
      assert.ok(!await configService.isSafeConfigKey('CODEBUDDY_BIN'));
      assert.ok(!await configService.isSafeConfigKey('WEB_HOST'));
    });

    test('should return false for unknown config keys', async () => {
      assert.ok(!await configService.isSafeConfigKey('UNKNOWN_KEY'));
    });
  });

  describe('audit logging', () => {
    test('should log config modifications', async () => {
      const result = await configService.setConfig('LOG_LEVEL', 'debug');
      assert.ok(result.success);
      assert.ok(result.auditLog);
      assert.ok(result.auditLog.includes('LOG_LEVEL'));
      assert.ok(result.auditLog.includes('debug'));
    });
  });
});