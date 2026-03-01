/**
 * Integration Test for F-006: Safety and Permission Guard
 * Tests the full security flow end-to-end.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkCommandPermission,
  getUserRole,
  isAdmin,
  setConfigForTesting,
  resetConfig as resetPermConfig
} from '../../src/security/permission-guard.js';
import {
  createConfirmation,
  checkConfirmation,
  confirmAction,
  cancelConfirmation,
  clearExpiredConfirmations
} from '../../src/security/confirmation-manager.js';
import { sanitizeParam, validatePath, detectDangerousPatterns as _detectDangerousPatterns } from '../../src/security/param-sanitizer.js';
import {
  initAuditLogService,
  logAuditEntry,
  queryAuditLogs,
  resetAuditLogService
} from '../../src/services/audit-log-service.js';

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

// Helper to create temp directory for audit log tests
async function withTempDir(fn) {
  const tempDir = await mkdtemp(join(tmpdir(), 'security-integration-'));
  try {
    return await fn(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// US-1: User Permission Levels
test('US-1: User permission levels work correctly', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  config.userPermissions.set('op-user', 'operator');
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  // Test role retrieval
  assert.equal(getUserRole('admin-user'), 'admin');
  assert.equal(getUserRole('op-user'), 'operator');
  assert.equal(getUserRole('viewer-user'), 'viewer');
  assert.equal(getUserRole('unknown-user'), 'operator'); // Default

  // Test isAdmin
  assert.equal(isAdmin('admin-user'), true);
  assert.equal(isAdmin('op-user'), false);
  assert.equal(isAdmin('viewer-user'), false);
});

// US-2: High-Risk Command Authorization
test('US-2: High-risk command authorization works correctly', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  config.userPermissions.set('op-user', 'operator');
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  // stop command - admin only
  const adminStopResult = checkCommandPermission('admin-user', 'stop');
  assert.equal(adminStopResult.allowed, true);
  assert.equal(adminStopResult.requiresConfirmation, true);

  const opStopResult = checkCommandPermission('op-user', 'stop');
  assert.equal(opStopResult.allowed, false);

  // retry command - operator level
  const opRetryResult = checkCommandPermission('op-user', 'retry');
  assert.equal(opRetryResult.allowed, true);
  assert.equal(opRetryResult.requiresConfirmation, false);

  const viewerRetryResult = checkCommandPermission('viewer-user', 'retry');
  assert.equal(viewerRetryResult.allowed, false);
});

// US-3: Parameter Sanitization
test('US-3: Parameter sanitization works correctly', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  // Valid input passes
  const validResult = sanitizeParam('my-feature-123', { maxLength: 100 });
  assert.equal(validResult.ok, true);

  // Dangerous patterns are blocked
  const traversalResult = sanitizeParam('../../../etc/passwd');
  assert.equal(traversalResult.ok, false);

  const shellInjectionResult = sanitizeParam('$(whoami)');
  assert.equal(shellInjectionResult.ok, false);

  // TargetId format validation
  const validTargetId = sanitizeParam('feature-branch_123', { isTargetId: true });
  assert.equal(validTargetId.ok, true);

  const invalidTargetId = sanitizeParam('feature/branch', { isTargetId: true });
  assert.equal(invalidTargetId.ok, false);

  // Path validation
  const validPath = validatePath('/project/src/file.js', ['/project']);
  assert.equal(validPath.ok, true);

  const invalidPath = validatePath('/etc/passwd', ['/project']);
  assert.equal(invalidPath.ok, false);
});

// US-4: Confirmation Flow
test('US-4: Confirmation flow works correctly', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  // Create confirmation
  const { confirmId, message } = createConfirmation('test-user', 'stop', { type: 'feature' });
  assert.ok(confirmId);
  assert.ok(message);

  // Check pending status
  const pendingResult = checkConfirmation(confirmId, 'test-user');
  assert.equal(pendingResult.status, 'pending');
  assert.equal(pendingResult.action, 'stop');

  // Confirm action
  const confirmResult = confirmAction(confirmId, 'test-user');
  assert.equal(confirmResult.ok, true);
  assert.equal(confirmResult.action, 'stop');

  // Verify consumed
  const consumedResult = checkConfirmation(confirmId, 'test-user');
  assert.equal(consumedResult.status, 'not_found');
});

test('US-4: Confirmation cancel works correctly', () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const { confirmId } = createConfirmation('test-user', 'reset', {});

  cancelConfirmation(confirmId, 'test-user');

  const result = checkConfirmation(confirmId, 'test-user');
  assert.equal(result.status, 'not_found');
});

test('US-4: Wrong user cannot confirm', () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const { confirmId } = createConfirmation('user-1', 'stop', {});

  const result = confirmAction(confirmId, 'user-2');
  assert.equal(result.ok, false);
});

// US-5: Audit Logging
test('US-5: Audit logging works correctly', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  await withTempDir(async (tempDir) => {
    await initAuditLogService({ logDir: tempDir, maxFileSizeMb: 10, maxFiles: 5 });

    // Log entry
    await logAuditEntry({
      userId: '123456789',
      action: 'stop',
      params: { type: 'feature' },
      result: 'success'
    });

    // Query logs
    const entries = await queryAuditLogs({ userId: '123456789' });
    assert.ok(entries.length >= 1);

    const entry = entries.find((e) => e.action === 'stop');
    assert.ok(entry);
    assert.equal(entry.userId, '123456789');
    assert.equal(entry.result, 'success');
  });
});

test('US-5: Audit log query filters work', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  await withTempDir(async (tempDir) => {
    await initAuditLogService({ logDir: tempDir, maxFileSizeMb: 10, maxFiles: 5 });

    await logAuditEntry({ userId: 'user-1', action: 'stop', params: {}, result: 'success' });
    await logAuditEntry({ userId: 'user-1', action: 'reset', params: {}, result: 'success' });
    await logAuditEntry({ userId: 'user-2', action: 'stop', params: {}, result: 'denied' });

    const user1Entries = await queryAuditLogs({ userId: 'user-1' });
    assert.ok(user1Entries.every((e) => e.userId === 'user-1'));

    const stopEntries = await queryAuditLogs({ action: 'stop' });
    assert.ok(stopEntries.every((e) => e.action === 'stop'));
  });
});

// F-001: force-unlock command
test('F-001: force-unlock command requires admin and confirmation', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  config.userPermissions.set('op-user', 'operator');
  setConfigForTesting(config);

  const adminResult = checkCommandPermission('admin-user', 'force-unlock');
  assert.equal(adminResult.allowed, true);
  assert.equal(adminResult.requiresConfirmation, true);

  const opResult = checkCommandPermission('op-user', 'force-unlock');
  assert.equal(opResult.allowed, false);
});

// F-002: exec command with ENABLE_SYSTEM_EXEC
test('F-002: exec command requires ENABLE_SYSTEM_EXEC', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const config = createTestConfig({ enableSystemExec: false });
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  const disabledResult = checkCommandPermission('admin-user', 'exec');
  assert.equal(disabledResult.allowed, false);
  assert.ok(disabledResult.reason.includes('系统命令执行未启用'));

  // Enable system exec
  config.enableSystemExec = true;
  setConfigForTesting(config);

  const enabledResult = checkCommandPermission('admin-user', 'exec');
  assert.equal(enabledResult.allowed, true);
});

// Full flow test: Operator stop flow (should be denied)
test('Integration: Operator cannot execute stop command', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  await withTempDir(async (tempDir) => {
    const config = createTestConfig();
    config.userPermissions.set('op-user', 'operator');
    setConfigForTesting(config);

    const result = checkCommandPermission('op-user', 'stop');
    assert.equal(result.allowed, false);

    // Log denial
    await initAuditLogService({ logDir: tempDir });
    await logAuditEntry({
      userId: 'op-user',
      action: 'stop',
      params: {},
      result: 'denied',
      reason: result.reason
    });

    const entries = await queryAuditLogs({ action: 'stop', userId: 'op-user' });
    assert.ok(entries.some((e) => e.result === 'denied'));
  });
});

// Full flow test: Admin stop with confirmation
test('Integration: Admin stop with confirmation flow', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  await withTempDir(async (tempDir) => {
    const config = createTestConfig();
    config.userPermissions.set('admin-user', 'admin');
    setConfigForTesting(config);

    // 1. Check permission
    const permResult = checkCommandPermission('admin-user', 'stop');
    assert.equal(permResult.allowed, true);
    assert.equal(permResult.requiresConfirmation, true);

    // 2. Create confirmation
    const { confirmId } = createConfirmation('admin-user', 'stop', { type: 'feature' });

    // 3. Confirm
    const confirmResult = confirmAction(confirmId, 'admin-user');
    assert.equal(confirmResult.ok, true);

    // 4. Log success
    await initAuditLogService({ logDir: tempDir });
    await logAuditEntry({
      userId: 'admin-user',
      action: 'stop',
      params: { type: 'feature' },
      result: 'success'
    });

    const entries = await queryAuditLogs({ userId: 'admin-user', action: 'stop' });
    assert.ok(entries.some((e) => e.result === 'success'));
  });
});

// AC-2.5: Error message security
test('AC-2.5: Error messages do not expose sensitive info', async () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'stop');
  assert.equal(result.allowed, false);
  assert.ok(!result.reason.includes('/'));
  assert.ok(!result.reason.includes('config'));
  assert.ok(!result.reason.includes('password'));
});

// NFR-1: Performance
test('NFR-1: Permission check is fast', () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const config = createTestConfig();
  config.userPermissions.set('test-user', 'admin');
  setConfigForTesting(config);

  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    checkCommandPermission('test-user', 'stop');
  }
  const duration = Date.now() - start;

  // 1000 checks should take < 50ms total (< 0.05ms per check, well under 5ms requirement)
  assert.ok(duration < 50, `Permission check too slow: ${duration}ms for 1000 checks`);
});

test('NFR-1: Param sanitization is fast', () => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();

  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    sanitizeParam('test-input-with-moderate-length', { maxLength: 100 });
  }
  const duration = Date.now() - start;

  // 1000 sanitizations should take < 20ms total (< 0.02ms per check, well under 2ms requirement)
  assert.ok(duration < 20, `Sanitization too slow: ${duration}ms for 1000 checks`);
});
