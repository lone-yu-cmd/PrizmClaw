/**
 * Tests for F-017 Config Command Handler
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMockContext } from '../../../helpers/mock-telegram.js';
import { setConfigForTesting, resetConfig } from '../../../../src/security/permission-guard.js';

// Set up environment before importing config service
process.env.LOG_LEVEL = 'info';
process.env.REQUEST_TIMEOUT_MS = '120000';
process.env.AI_CLI_HEARTBEAT_MS = '30000';
process.env.TELEGRAM_BOT_TOKEN = 'test-token-12345';

import { configMeta, handleConfig } from '../../../../src/bot/commands/handlers/config.js';

describe('F-017 Config Command Handler', () => {
  let mockContext;
  let mockReply;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up permission guard for testing
    setConfigForTesting({
      userPermissions: new Map([
        ['123456789', 'admin'], // Admin user
        ['987654321', 'viewer']  // Non-admin user
      ])
    });

    // Create mock context
    mockReply = [];
    mockContext = createMockContext({
      reply: (message) => {
        mockReply.push(message);
        return Promise.resolve();
      },
      sessionId: 'test-session-001',
      userId: '123456789',
      args: []
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    mockReply = [];
    resetConfig();
  });

  describe('Command Metadata', () => {
    test('should have correct command metadata', () => {
      assert.equal(configMeta.name, 'config');
      assert.deepEqual(configMeta.aliases, ['cfg', 'settings']);
      assert.equal(configMeta.description, '查看和修改运行时配置');
      assert.equal(configMeta.minRole, 'admin');
      assert.equal(configMeta.requiresAuth, true);
    });

    test('should have subcommands defined', () => {
      assert.ok(configMeta.subcommands);
      assert.equal(configMeta.subcommands.length, 3);
      assert.equal(configMeta.subcommands[0].name, 'get');
      assert.equal(configMeta.subcommands[1].name, 'set');
      assert.equal(configMeta.subcommands[2].name, 'reset');
    });
  });

  describe('List Config (/config)', () => {
    test('should list all config values with sensitive fields masked', async () => {
      mockContext.args = [];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];

      // Should contain config categories
      assert.ok(replyText.includes('📋 **当前配置值**'));
      assert.ok(replyText.includes('📊 日志设置'));
      assert.ok(replyText.includes('⏱️ 超时设置'));
      assert.ok(replyText.includes('🤖 AI CLI 设置'));
      assert.ok(replyText.includes('🔒 安全设置'));

      // Should contain help text
      assert.ok(replyText.includes('使用 `/config get <KEY>`'));
      assert.ok(replyText.includes('使用 `/config set <KEY>=<VALUE>`'));
      assert.ok(replyText.includes('使用 `/config reset <KEY>`'));
    });
  });

  describe('Get Config (/config get)', () => {
    test('should return specific config value', async () => {
      mockContext.args = ['get', 'LOG_LEVEL'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('🔍 **LOG_LEVEL**: `info`'));
    });

    test('should mask sensitive config values', async () => {
      mockContext.args = ['get', 'TELEGRAM_BOT_TOKEN'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('🔍 **TELEGRAM_BOT_TOKEN**: `***`'));
    });

    test('should handle unknown config keys', async () => {
      mockContext.args = ['get', 'UNKNOWN_KEY'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('❌ 未知的配置项'));
    });
  });

  describe('Set Config (/config set)', () => {
    test('should allow setting safe config values', async () => {
      mockContext.args = ['set', 'LOG_LEVEL=debug'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('✅ **配置修改成功**'));
      assert.ok(replyText.includes('**配置项**: `LOG_LEVEL`'));
      assert.ok(replyText.includes('**新值**: `debug`'));
    });

    test('should reject setting sensitive config keys', async () => {
      mockContext.args = ['set', 'TELEGRAM_BOT_TOKEN=new-token'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('❌ 配置项 `TELEGRAM_BOT_TOKEN` 不允许在运行时修改'));
    });

    test('should validate config value format', async () => {
      mockContext.args = ['set', 'LOG_LEVEL=invalid-level'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('❌ 配置修改失败'));
    });

    test('should handle malformed input', async () => {
      mockContext.args = ['set', 'LOG_LEVEL'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('❌ 格式错误'));
    });
  });

  describe('Reset Config (/config reset)', () => {
    test('should reset config to original value', async () => {
      // First set a new value
      mockContext.args = ['set', 'LOG_LEVEL=debug'];
      mockContext.userId = '123456789'; // Admin user
      await handleConfig(mockContext);

      // Then reset it
      mockContext.args = ['reset', 'LOG_LEVEL'];
      await handleConfig(mockContext);

      assert.ok(mockReply.length > 1);
      const resetReply = mockReply[1];
      assert.ok(resetReply.includes('🔄 **配置重置成功**'));
      assert.ok(resetReply.includes('**恢复值**: `info`'));
    });

    test('should reject reset for sensitive config keys', async () => {
      mockContext.args = ['reset', 'TELEGRAM_BOT_TOKEN'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('❌ 配置项 `TELEGRAM_BOT_TOKEN` 不允许在运行时修改'));
    });
  });

  describe('Permission Checks', () => {
    test('should reject non-admin users', async () => {
      mockContext.args = [];
      mockContext.userId = '987654321'; // Non-admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('❌ 权限不足。此命令需要管理员权限。'));
    });
  });

  describe('Help Command', () => {
    test('should show help for invalid subcommands', async () => {
      mockContext.args = ['invalid'];
      mockContext.userId = '123456789'; // Admin user

      await handleConfig(mockContext);

      assert.ok(mockReply.length > 0);
      const replyText = mockReply[0];
      assert.ok(replyText.includes('📋 **配置管理命令**'));
      assert.ok(replyText.includes('**基本用法**'));
      assert.ok(replyText.includes('**安全配置项**'));
      assert.ok(replyText.includes('**敏感配置项**'));
    });
  });
});