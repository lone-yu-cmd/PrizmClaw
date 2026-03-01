/**
 * Tests for F-009 permission-guard extensions
 * T-2.2: Update permission-guard.js for new commands
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-009 Permission Guard Extensions', () => {
  describe('cd command permission', () => {
    test('should allow operator for cd command', async () => {
      const { checkCommandPermission, setConfigForTesting, resetConfig } = await import('../../src/security/permission-guard.js');

      // Create mock config with operator user
      const mockConfig = {
        userPermissions: new Map([['123', 'operator']]),
        enableSystemExec: true
      };
      setConfigForTesting(mockConfig);

      const result = checkCommandPermission('123', 'cd');
      assert.equal(result.allowed, true);

      resetConfig();
    });

    test('should deny viewer for cd command (requires operator)', async () => {
      const { checkCommandPermission, setConfigForTesting, resetConfig } = await import('../../src/security/permission-guard.js');

      const mockConfig = {
        userPermissions: new Map([['456', 'viewer']]),
        enableSystemExec: true
      };
      setConfigForTesting(mockConfig);

      const result = checkCommandPermission('456', 'cd');
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('权限不足'));

      resetConfig();
    });
  });

  describe('more command permission', () => {
    test('should allow viewer for more command', async () => {
      const { checkCommandPermission, setConfigForTesting, resetConfig } = await import('../../src/security/permission-guard.js');

      const mockConfig = {
        userPermissions: new Map([['789', 'viewer']]),
        enableSystemExec: true
      };
      setConfigForTesting(mockConfig);

      const result = checkCommandPermission('789', 'more');
      assert.equal(result.allowed, true);

      resetConfig();
    });

    test('should allow operator for more command', async () => {
      const { checkCommandPermission, setConfigForTesting, resetConfig } = await import('../../src/security/permission-guard.js');

      const mockConfig = {
        userPermissions: new Map([['111', 'operator']]),
        enableSystemExec: true
      };
      setConfigForTesting(mockConfig);

      const result = checkCommandPermission('111', 'more');
      assert.equal(result.allowed, true);

      resetConfig();
    });
  });

  describe('exec command high-risk handling', () => {
    test('exec should not be in HIGH_RISK_COMMANDS', async () => {
      // Import the module to check that exec is not in HIGH_RISK_COMMANDS
      const module = await import('../../src/security/permission-guard.js');
      // The module exports checkCommandPermission, and exec should not require confirmation
      // (high-risk is handled separately via keyword detection)

      const { checkCommandPermission, setConfigForTesting, resetConfig } = module;

      const mockConfig = {
        userPermissions: new Map([['222', 'admin']]),
        enableSystemExec: true
      };
      setConfigForTesting(mockConfig);

      const result = checkCommandPermission('222', 'exec');
      // exec should be allowed for admin, and should not require confirmation at this level
      // (confirmation is handled by high-risk keyword detection in command-executor-service)
      assert.equal(result.allowed, true);
      // Note: exec is not in HIGH_RISK_COMMANDS, so requiresConfirmation should be false
      assert.equal(result.requiresConfirmation, false);

      resetConfig();
    });
  });
});
