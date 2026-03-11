/**
 * Tests for permission-guard.js
 * F-006: Safety and Permission Guard
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserRole,
  checkCommandPermission,
  isAdmin,
  ROLE_HIERARCHY,
  setConfigForTesting,
  resetConfig
} from '../../src/security/permission-guard.js';

// Helper to create test config
function createTestConfig(overrides = {}) {
  return {
    userPermissions: new Map(),
    allowAdminSkipConfirm: true,
    enableSystemExec: false,
    allowedUserIds: new Set(),
    ...overrides
  };
}

// ROLE_HIERARCHY tests
test('ROLE_HIERARCHY defines correct hierarchy levels', () => {
  resetConfig();
  assert.equal(ROLE_HIERARCHY.viewer, 0);
  assert.equal(ROLE_HIERARCHY.operator, 1);
  assert.equal(ROLE_HIERARCHY.admin, 2);
});

// getUserRole tests
test('getUserRole returns admin for configured admin user', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('123456789', 'admin');
  setConfigForTesting(config);

  assert.equal(getUserRole('123456789'), 'admin');
});

test('getUserRole returns operator for configured operator user', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('987654321', 'operator');
  setConfigForTesting(config);

  assert.equal(getUserRole('987654321'), 'operator');
});

test('getUserRole returns viewer for configured viewer user', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('111222333', 'viewer');
  setConfigForTesting(config);

  assert.equal(getUserRole('111222333'), 'viewer');
});

test('getUserRole returns operator as default for unknown users (AC-1.3)', () => {
  resetConfig();
  setConfigForTesting(createTestConfig());
  assert.equal(getUserRole('unknown-user'), 'operator');
});

test('getUserRole handles numeric userId', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('123456789', 'admin');
  setConfigForTesting(config);

  assert.equal(getUserRole(123456789), 'admin');
});

// isAdmin tests
test('isAdmin returns true for admin user', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('123456789', 'admin');
  setConfigForTesting(config);

  assert.equal(isAdmin('123456789'), true);
});

test('isAdmin returns false for operator user', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('987654321', 'operator');
  setConfigForTesting(config);

  assert.equal(isAdmin('987654321'), false);
});

test('isAdmin returns false for viewer user', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('111222333', 'viewer');
  setConfigForTesting(config);

  assert.equal(isAdmin('111222333'), false);
});

test('isAdmin returns false for unknown user (default is operator)', () => {
  resetConfig();
  setConfigForTesting(createTestConfig());
  assert.equal(isAdmin('unknown-user'), false);
});

// checkCommandPermission - status command (viewer)
test('checkCommandPermission allows viewer to execute status', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'status');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, false);
});

// checkCommandPermission - logs command (viewer)
test('checkCommandPermission allows viewer to execute logs', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'logs');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, false);
});

// checkCommandPermission - pipeline command (operator)
test('checkCommandPermission allows operator to execute pipeline', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'pipeline');
  assert.equal(result.allowed, true);
});

test('checkCommandPermission denies viewer for pipeline', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'pipeline');
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('权限不足'));
});

// checkCommandPermission - retry command (operator) - AC-2.3
test('checkCommandPermission allows operator for retry without confirmation', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'retry');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, false);
});

test('checkCommandPermission denies viewer for retry', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'retry');
  assert.equal(result.allowed, false);
});

// checkCommandPermission - stop command (admin) - AC-2.2
test('checkCommandPermission allows admin for stop with confirmation', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  const result = checkCommandPermission('admin-user', 'stop');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, true);
});

test('checkCommandPermission denies operator for stop', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'stop');
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('权限不足'));
});

test('checkCommandPermission denies viewer for stop', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'stop');
  assert.equal(result.allowed, false);
});

// checkCommandPermission - reset command (admin) - AC-2.2
test('checkCommandPermission allows admin for reset with confirmation', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  const result = checkCommandPermission('admin-user', 'reset');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, true);
});

test('checkCommandPermission denies operator for reset', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'reset');
  assert.equal(result.allowed, false);
});

// checkCommandPermission - force-unlock command (admin) - F-001
test('checkCommandPermission requires admin for force-unlock', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  const result = checkCommandPermission('admin-user', 'force-unlock');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, true);
});

test('checkCommandPermission denies operator for force-unlock', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'force-unlock');
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('权限不足'));
});

// checkCommandPermission - exec command (admin + ENABLE_SYSTEM_EXEC) - AC-2.4, F-002
test('checkCommandPermission denies exec when ENABLE_SYSTEM_EXEC is false', () => {
  resetConfig();
  const config = createTestConfig({ enableSystemExec: false });
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  const result = checkCommandPermission('admin-user', 'exec');
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('系统命令执行未启用'));
});

test('checkCommandPermission allows admin for exec when ENABLE_SYSTEM_EXEC is true', () => {
  resetConfig();
  const config = createTestConfig({ enableSystemExec: true });
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  const result = checkCommandPermission('admin-user', 'exec');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, false);
});

test('checkCommandPermission denies operator for exec even when ENABLE_SYSTEM_EXEC is true', () => {
  resetConfig();
  const config = createTestConfig({ enableSystemExec: true });
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'exec');
  assert.equal(result.allowed, false);
});

// checkCommandPermission - unknown command
test('checkCommandPermission allows unknown command by default (defensive but permissive)', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const result = checkCommandPermission('op-user', 'unknown-command');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, false);
});

// error message security - AC-2.5
test('checkCommandPermission does not expose internal paths in error messages', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'stop');
  assert.ok(!result.reason.includes('/var/'));
  assert.ok(!result.reason.includes('/home/'));
  assert.ok(!result.reason.includes('config'));
});

test('checkCommandPermission provides unified denial message', () => {
  resetConfig();
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'stop');
  assert.ok(result.reason.match(/权限不足|未授权/));
});
