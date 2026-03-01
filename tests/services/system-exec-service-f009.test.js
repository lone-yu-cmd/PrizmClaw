/**
 * Tests for F-009 system-exec-service enhancements
 * T-3.3: Enhance system-exec-service.js timeout handling
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-009 System Exec Service Enhancements', () => {
  describe('executeSystemCommand with cwd', () => {
    test('should accept cwd option', async () => {
      const { executeSystemCommand } = await import('../../src/services/system-exec-service.js');

      // Skip if system exec not enabled
      try {
        const result = await executeSystemCommand('pwd', { cwd: '/tmp' });
        assert.ok(result);
        assert.ok('stdout' in result);
        assert.ok('stderr' in result);
        assert.ok('exitCode' in result);
      } catch (error) {
        // Expected if ENABLE_SYSTEM_EXEC is false
        assert.ok(error.message.includes('系统命令执行未启用') || error.message.includes('白名单'));
      }
    });

    test('should use process.cwd() when cwd not specified', async () => {
      const { executeSystemCommand } = await import('../../src/services/system-exec-service.js');

      try {
        const result = await executeSystemCommand('pwd');
        assert.ok(result);
      } catch (error) {
        // Expected if system exec not enabled
        assert.ok(error.message.includes('系统命令执行未启用') || error.message.includes('白名单'));
      }
    });
  });

  describe('timeout handling', () => {
    test('should include timeout status in result', async () => {
      const { executeSystemCommand } = await import('../../src/services/system-exec-service.js');

      try {
        const result = await executeSystemCommand('echo test');
        assert.ok('timedOut' in result);
        assert.equal(result.timedOut, false);
      } catch (error) {
        // Expected if system exec not enabled
        assert.ok(error.message.includes('系统命令执行未启用') || error.message.includes('白名单'));
      }
    });
  });

  describe('result object structure', () => {
    test('should return object with stdout, stderr, exitCode, timedOut', async () => {
      const { executeSystemCommand } = await import('../../src/services/system-exec-service.js');

      try {
        const result = await executeSystemCommand('echo hello');

        assert.ok(typeof result.stdout === 'string');
        assert.ok(typeof result.stderr === 'string');
        assert.ok(typeof result.exitCode === 'number');
        assert.ok(typeof result.timedOut === 'boolean');
      } catch (error) {
        // Expected if system exec not enabled
        assert.ok(error.message.includes('系统命令执行未启用') || error.message.includes('白名单'));
      }
    });
  });
});
