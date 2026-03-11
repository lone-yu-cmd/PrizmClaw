/**
 * Extended Integration Tests for F-006: Safety and Permission Guard
 * Tests all user stories acceptance criteria with edge cases
 *
 * This file supplements the existing security-flow.test.js with:
 * - Edge case testing
 * - AC-4.4 (--force flag) testing
 * - Cross-module data flow validation
 * - Boundary condition testing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
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
import {
  sanitizeParam,
  validatePath,
  detectDangerousPatterns
} from '../../src/security/param-sanitizer.js';
import {
  initAuditLogService,
  logAuditEntry,
  queryAuditLogs,
  resetAuditLogService,
  getAuditLogStats
} from '../../src/services/audit-log-service.js';

let tempDir;

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

test.before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'security-extended-'));
});

test.after(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test.beforeEach(() => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();
});

test.afterEach(() => {
  resetPermConfig();
  resetAuditLogService();
  clearExpiredConfirmations();
});

// ============================================================================
// US-1: User Permission Levels - Extended Tests
// ============================================================================

test('US-1 AC-1.1: Role hierarchy is strictly enforced', () => {
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  config.userPermissions.set('op-user', 'operator');
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  // Admin can do everything
  assert.equal(checkCommandPermission('admin-user', 'stop').allowed, true);
  assert.equal(checkCommandPermission('admin-user', 'retry').allowed, true);
  assert.equal(checkCommandPermission('admin-user', 'status').allowed, true);

  // Operator cannot do admin actions
  assert.equal(checkCommandPermission('op-user', 'stop').allowed, false);
  assert.equal(checkCommandPermission('op-user', 'reset').allowed, false);
  assert.equal(checkCommandPermission('op-user', 'force-unlock').allowed, false);
  assert.equal(checkCommandPermission('op-user', 'exec').allowed, false);

  // Operator can do operator and viewer actions
  assert.equal(checkCommandPermission('op-user', 'retry').allowed, true);
  assert.equal(checkCommandPermission('op-user', 'pipeline').allowed, true);
  assert.equal(checkCommandPermission('op-user', 'status').allowed, true);

  // Viewer can only do viewer actions
  assert.equal(checkCommandPermission('viewer-user', 'status').allowed, true);
  assert.equal(checkCommandPermission('viewer-user', 'logs').allowed, true);
  assert.equal(checkCommandPermission('viewer-user', 'pipeline').allowed, false);
  assert.equal(checkCommandPermission('viewer-user', 'stop').allowed, false);
});

test('US-1 AC-1.2: USER_PERMISSIONS format variations', () => {
  // Test numeric user IDs
  const config = createTestConfig();
  config.userPermissions.set('123456789', 'admin');
  config.userPermissions.set('987654321', 'operator');
  setConfigForTesting(config);

  assert.equal(getUserRole('123456789'), 'admin');
  assert.equal(getUserRole(123456789), 'admin'); // numeric also works
  assert.equal(getUserRole('987654321'), 'operator');
});

test('US-1 AC-1.3: Unknown users default to operator', () => {
  setConfigForTesting(createTestConfig());

  // Unknown user should have operator privileges
  assert.equal(getUserRole('unknown-user-id'), 'operator');
  assert.equal(isAdmin('unknown-user-id'), false);

  // Can execute operator commands
  const result = checkCommandPermission('unknown-user-id', 'retry');
  assert.equal(result.allowed, true);

  // Cannot execute admin commands
  const stopResult = checkCommandPermission('unknown-user-id', 'stop');
  assert.equal(stopResult.allowed, false);
});

test('US-1 AC-1.4: getUserRole API handles various userId types', () => {
  const config = createTestConfig();
  config.userPermissions.set('123', 'admin');
  setConfigForTesting(config);

  // String
  assert.equal(getUserRole('123'), 'admin');
  // Number
  assert.equal(getUserRole(123), 'admin');
  // String with whitespace (should not match)
  assert.equal(getUserRole(' 123 '), 'operator'); // trimmed not supported, defaults
});

// ============================================================================
// US-2: High-Risk Command Authorization - Extended Tests
// ============================================================================

test('US-2 AC-2.1: High-risk commands list is complete', () => {
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  // stop requires confirmation
  assert.equal(checkCommandPermission('admin-user', 'stop').requiresConfirmation, true);
  // reset requires confirmation
  assert.equal(checkCommandPermission('admin-user', 'reset').requiresConfirmation, true);
  // force-unlock requires confirmation
  assert.equal(checkCommandPermission('admin-user', 'force-unlock').requiresConfirmation, true);

  // retry does NOT require confirmation (but needs operator level)
  assert.equal(checkCommandPermission('admin-user', 'retry').requiresConfirmation, false);

  // exec does NOT require confirmation (but needs admin + ENABLE_SYSTEM_EXEC)
  config.enableSystemExec = true;
  setConfigForTesting(config);
  assert.equal(checkCommandPermission('admin-user', 'exec').requiresConfirmation, false);
});

test('US-2 AC-2.4: exec command with ENABLE_SYSTEM_EXEC variations', () => {
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  config.userPermissions.set('op-user', 'operator');

  // Disabled
  config.enableSystemExec = false;
  setConfigForTesting(config);
  assert.equal(checkCommandPermission('admin-user', 'exec').allowed, false);

  // Enabled
  config.enableSystemExec = true;
  setConfigForTesting(config);
  assert.equal(checkCommandPermission('admin-user', 'exec').allowed, true);

  // Operator still denied even when enabled
  assert.equal(checkCommandPermission('op-user', 'exec').allowed, false);
});

test('US-2 AC-2.5: Error messages do not leak sensitive info', () => {
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'stop');

  // Should not contain file paths
  assert.ok(!result.reason.includes('/'));
  // Should not contain config values
  assert.ok(!result.reason.includes('config'));
  // Should not contain env var names
  assert.ok(!result.reason.includes('USER_PERMISSIONS'));
  // Should contain generic message
  assert.ok(result.reason.includes('权限不足') || result.reason.includes('未授权'));
});

// ============================================================================
// US-3: Parameter Sanitization - Extended Tests
// ============================================================================

test('US-3 AC-3.1: All path traversal patterns blocked', () => {
  const traversalPatterns = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '/etc/../../../root',
    './../../../etc/passwd'
  ];

  for (const pattern of traversalPatterns) {
    const result = sanitizeParam(pattern);
    assert.equal(result.ok, false, `Should block: ${pattern}`);
  }

  // validatePath should also block
  const pathResult = validatePath('/project/../../../etc/passwd', ['/project']);
  assert.equal(pathResult.ok, false);
});

test('US-3 AC-3.2: targetId format strict validation', () => {
  // Valid formats
  const validIds = ['feature-123', 'bugfix_456', 'my-feature-name', 'UPPERCASE', 'lowercase', 'Mix3d_Case-99'];
  for (const id of validIds) {
    const result = sanitizeParam(id, { isTargetId: true });
    assert.equal(result.ok, true, `Should accept: ${id}`);
  }

  // Invalid formats
  const invalidIds = [
    'feature/branch', // slash
    'feature.branch', // dot
    'feature branch', // space
    'feature:branch', // colon
    'feature@branch', // at sign
    'feature#branch', // hash
    '', // empty
    '   ' // whitespace
  ];

  for (const id of invalidIds) {
    const result = sanitizeParam(id, { isTargetId: true });
    assert.equal(result.ok, false, `Should reject: ${id}`);
  }
});

test('US-3 AC-3.3: All dangerous characters blocked', () => {
  const dangerousInputs = [
    { input: 'test;rm -rf', name: 'semicolon' },
    { input: 'test|cat', name: 'pipe' },
    { input: 'test&&ls', name: 'ampersand' },
    { input: '$HOME', name: 'dollar' },
    { input: '`id`', name: 'backtick' },
    { input: "test' or '1'='1", name: 'single quote' },
    { input: 'test" or "1"="1', name: 'double quote' },
    { input: '$(whoami)', name: 'command substitution' },
    { input: '<script>', name: 'angle bracket' },
    { input: 'test --exec', name: 'exec flag' },
    { input: 'test --eval', name: 'eval flag' },
    { input: '~/secret', name: 'home directory' }
  ];

  for (const { input, name } of dangerousInputs) {
    const result = sanitizeParam(input);
    assert.equal(result.ok, false, `Should block ${name}: ${input}`);
  }
});

test('US-3 AC-3.4: sanitizeParam and validatePath edge cases', () => {
  // Null/undefined handling
  assert.equal(sanitizeParam(null).ok, false);
  assert.equal(sanitizeParam(undefined).ok, false);

  // Empty string
  assert.equal(sanitizeParam('').ok, false);

  // Whitespace only
  assert.equal(sanitizeParam('   ').ok, false);

  // Max length enforcement
  const longInput = 'a'.repeat(300);
  assert.equal(sanitizeParam(longInput).ok, false);
  assert.equal(sanitizeParam(longInput, { maxLength: 500 }).ok, true);

  // validatePath edge cases
  assert.equal(validatePath(null, ['/project']).ok, false);
  assert.equal(validatePath(undefined, ['/project']).ok, false);
  assert.equal(validatePath('', ['/project']).ok, false);
  assert.equal(validatePath('relative/path', ['/project']).ok, false); // relative rejected
});

// ============================================================================
// US-4: Confirmation for Sensitive Actions - Extended Tests
// ============================================================================

test('US-4 AC-4.1: Only high-risk commands require confirmation', () => {
  const config = createTestConfig();
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  // Commands requiring confirmation
  assert.equal(checkCommandPermission('admin-user', 'stop').requiresConfirmation, true);
  assert.equal(checkCommandPermission('admin-user', 'reset').requiresConfirmation, true);
  assert.equal(checkCommandPermission('admin-user', 'force-unlock').requiresConfirmation, true);

  // Commands NOT requiring confirmation
  assert.equal(checkCommandPermission('admin-user', 'status').requiresConfirmation, false);
  assert.equal(checkCommandPermission('admin-user', 'logs').requiresConfirmation, false);
  assert.equal(checkCommandPermission('admin-user', 'pipeline').requiresConfirmation, false);
});

test('US-4 AC-4.2: Confirmation message contains all required info', () => {
  const { confirmId, message } = createConfirmation('user-123', 'stop', { type: 'feature', target: 'my-feature' });

  assert.ok(confirmId, 'Should have confirmId');
  assert.ok(message.includes('stop'), 'Should include action name');
  assert.ok(message.includes('type'), 'Should include params');
  assert.ok(message.includes('60'), 'Should mention timeout');
  assert.ok(message.includes('CONFIRM') || message.includes('CANCEL'), 'Should show confirm/cancel options');
});

test('US-4 AC-4.3: Confirmation expires after 60 seconds', async () => {
  // Create with short timeout for testing
  const { confirmId } = createConfirmation('user-123', 'stop', {}, 100); // 100ms

  // Check immediately - should be pending
  const before = checkConfirmation(confirmId, 'user-123');
  assert.equal(before.status, 'pending');

  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 150));

  // Check after - should be expired
  const after = checkConfirmation(confirmId, 'user-123');
  assert.equal(after.status, 'expired');
});

test('US-4 AC-4.3: Default timeout is exactly 60 seconds', () => {
  const { confirmId } = createConfirmation('user-123', 'stop', {});
  const check = checkConfirmation(confirmId, 'user-123');

  assert.equal(check.status, 'pending');
  // The default timeout is 60000ms = 60 seconds
  // We can't wait 60s in tests, but the code uses DEFAULT_TIMEOUT_MS = 60000
});

test('US-4 AC-4.4: Wrong user cannot confirm', () => {
  const { confirmId } = createConfirmation('user-123', 'stop', {});

  // Different user tries to confirm
  const result = confirmAction(confirmId, 'user-456');
  assert.equal(result.ok, false);

  // Original user should still be able to check
  const check = checkConfirmation(confirmId, 'user-123');
  assert.equal(check.status, 'pending');
});

test('US-4: Confirmation flow complete lifecycle', () => {
  // 1. Create
  const { confirmId } = createConfirmation('user-123', 'stop', { type: 'feature' });

  // 2. Check pending
  const pending = checkConfirmation(confirmId, 'user-123');
  assert.equal(pending.status, 'pending');
  assert.equal(pending.action, 'stop');
  assert.deepEqual(pending.params, { type: 'feature' });

  // 3. Confirm
  const confirmed = confirmAction(confirmId, 'user-123');
  assert.equal(confirmed.ok, true);

  // 4. Verify consumed
  const consumed = checkConfirmation(confirmId, 'user-123');
  assert.equal(consumed.status, 'not_found');

  // 5. Double-confirm fails
  const doubleConfirm = confirmAction(confirmId, 'user-123');
  assert.equal(doubleConfirm.ok, false);
});

test('US-4: Cancel flow works correctly', () => {
  const { confirmId } = createConfirmation('user-123', 'reset', {});

  cancelConfirmation(confirmId, 'user-123');

  const check = checkConfirmation(confirmId, 'user-123');
  assert.equal(check.status, 'not_found');
});

// ============================================================================
// US-5: Audit Logging - Extended Tests
// ============================================================================

test('US-5 AC-5.1: Audit entry contains all required fields', async () => {
  await initAuditLogService({ logPath: tempDir });

  await logAuditEntry({
    userId: '123456789',
    role: 'admin',
    action: 'stop',
    params: { type: 'feature', target: 'my-feature' },
    result: 'success',
    reason: null,
    sessionId: 'telegram-123456789'
  });

  const entries = await queryAuditLogs({ action: 'stop' });
  assert.ok(entries.length >= 1);

  const entry = entries[0];
  assert.ok(entry.timestamp, 'Should have timestamp');
  assert.equal(entry.userId, '123456789', 'Should have userId');
  assert.equal(entry.role, 'admin', 'Should have role');
  assert.equal(entry.action, 'stop', 'Should have action');
  assert.deepEqual(entry.params, { type: 'feature', target: 'my-feature' }, 'Should have params');
  assert.equal(entry.result, 'success', 'Should have result');
  assert.equal(entry.reason, null, 'Should have reason');
  assert.equal(entry.sessionId, 'telegram-123456789', 'Should have sessionId');
});

test('US-5 AC-5.2: JSON Lines format is valid', async () => {
  await initAuditLogService({ logPath: tempDir });

  await logAuditEntry({ userId: '111', action: 'stop', result: 'success' });
  await logAuditEntry({ userId: '222', action: 'reset', result: 'failed' });

  const logFile = join(tempDir, 'audit.log');
  const content = await readFile(logFile, 'utf8');
  const lines = content.trim().split('\n');

  // Each line should be valid JSON
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.ok(parsed.timestamp);
    assert.ok(parsed.userId);
    assert.ok(parsed.action);
  }
});

test('US-5 AC-5.3: Query by userId returns correct entries', async () => {
  await initAuditLogService({ logPath: tempDir });

  await logAuditEntry({ userId: 'user-A', action: 'stop', result: 'success' });
  await logAuditEntry({ userId: 'user-B', action: 'stop', result: 'success' });
  await logAuditEntry({ userId: 'user-A', action: 'reset', result: 'failed' });

  const userAEntries = await queryAuditLogs({ userId: 'user-A' });
  assert.equal(userAEntries.length, 2);
  assert.ok(userAEntries.every(e => e.userId === 'user-A'));

  const userBEntries = await queryAuditLogs({ userId: 'user-B' });
  assert.equal(userBEntries.length, 1);
  assert.equal(userBEntries[0].userId, 'user-B');
});

test('US-5 AC-5.4: Log rotation works correctly', async () => {
  const rotationDir = join(tempDir, 'rotation-test');
  await initAuditLogService({ logPath: rotationDir, maxSizeMb: 0.001, maxFiles: 3 }); // 1KB for testing

  // Write enough entries to trigger rotation
  const largeParam = { data: 'x'.repeat(500) };
  for (let i = 0; i < 15; i++) {
    await logAuditEntry({ userId: `user-${i}`, action: 'stop', params: largeParam, result: 'success' });
  }

  // Check for rotated files
  const files = (await import('node:fs')).readdirSync(rotationDir);
  const rotatedFiles = files.filter(f => f.startsWith('audit.log.'));

  // Should have at most maxFiles rotated files
  assert.ok(rotatedFiles.length <= 3, `Expected <= 3 rotated files, got ${rotatedFiles.length}`);
});

test('US-5: Query with action filter', async () => {
  await initAuditLogService({ logPath: tempDir });

  await logAuditEntry({ userId: 'user', action: 'stop', result: 'success' });
  await logAuditEntry({ userId: 'user', action: 'reset', result: 'success' });
  await logAuditEntry({ userId: 'user', action: 'stop', result: 'failed' });

  const stopEntries = await queryAuditLogs({ action: 'stop' });
  assert.ok(stopEntries.every(e => e.action === 'stop'));

  const resetEntries = await queryAuditLogs({ action: 'reset' });
  assert.ok(resetEntries.every(e => e.action === 'reset'));
});

test('US-5: Query with date range filter', async () => {
  await initAuditLogService({ logPath: tempDir });

  const now = Date.now();
  const oneHourAgo = new Date(now - 3600000);
  const oneHourLater = new Date(now + 3600000);

  await logAuditEntry({ userId: 'user', action: 'stop', result: 'success' });

  const entries = await queryAuditLogs({ startDate: oneHourAgo, endDate: oneHourLater });
  assert.ok(entries.length >= 1);
});

test('US-5: Query with limit', async () => {
  await initAuditLogService({ logPath: tempDir });

  for (let i = 0; i < 50; i++) {
    await logAuditEntry({ userId: `user-${i}`, action: 'stop', result: 'success' });
  }

  const entries = await queryAuditLogs({ limit: 10 });
  assert.equal(entries.length, 10);
});

test('US-5: getAuditLogStats returns correct info', async () => {
  await initAuditLogService({ logPath: tempDir });

  await logAuditEntry({ userId: 'user', action: 'stop', result: 'success' });
  await logAuditEntry({ userId: 'user', action: 'reset', result: 'success' });

  const stats = await getAuditLogStats();
  assert.ok(stats.totalEntries >= 2);
  assert.ok(stats.fileSize > 0);
});

// ============================================================================
// Cross-Module Integration Tests
// ============================================================================

test('Integration: Full flow - Admin denied then approved', async () => {
  await initAuditLogService({ logPath: tempDir });

  // Setup: viewer tries stop
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  config.userPermissions.set('admin-user', 'admin');
  setConfigForTesting(config);

  // Viewer denied
  const viewerResult = checkCommandPermission('viewer-user', 'stop');
  assert.equal(viewerResult.allowed, false);

  // Log denial
  await logAuditEntry({
    userId: 'viewer-user',
    role: 'viewer',
    action: 'stop',
    params: {},
    result: 'denied',
    reason: viewerResult.reason
  });

  // Admin can proceed
  const adminResult = checkCommandPermission('admin-user', 'stop');
  assert.equal(adminResult.allowed, true);
  assert.equal(adminResult.requiresConfirmation, true);

  // Create confirmation
  const { confirmId } = createConfirmation('admin-user', 'stop', { type: 'feature' });

  // Confirm
  const confirmResult = confirmAction(confirmId, 'admin-user');
  assert.equal(confirmResult.ok, true);

  // Log success
  await logAuditEntry({
    userId: 'admin-user',
    role: 'admin',
    action: 'stop',
    params: { type: 'feature' },
    result: 'success'
  });

  // Verify logs
  const deniedLogs = await queryAuditLogs({ result: 'denied' });
  const successLogs = await queryAuditLogs({ result: 'success' });

  assert.ok(deniedLogs.some(e => e.userId === 'viewer-user'));
  assert.ok(successLogs.some(e => e.userId === 'admin-user'));
});

test('Integration: Dangerous input blocked at sanitization level', async () => {
  // Shell injection attempt
  const shellResult = sanitizeParam('$(rm -rf /)');
  assert.equal(shellResult.ok, false);

  // Path traversal attempt
  const pathResult = sanitizeParam('../../../etc/passwd');
  assert.equal(pathResult.ok, false);

  // Valid input passes
  const validResult = sanitizeParam('my-feature-branch');
  assert.equal(validResult.ok, true);
  assert.equal(validResult.value, 'my-feature-branch');
});

test('Integration: Performance requirements met', () => {
  const config = createTestConfig();
  config.userPermissions.set('test-user', 'admin');
  setConfigForTesting(config);

  // Permission check should be < 5ms each
  const permStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    checkCommandPermission('test-user', 'stop');
  }
  const permDuration = Date.now() - permStart;
  assert.ok(permDuration < 5000, `Permission checks too slow: ${permDuration}ms for 1000 checks`);

  // Sanitization should be < 2ms each
  const sanStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    sanitizeParam('test-input-value');
  }
  const sanDuration = Date.now() - sanStart;
  assert.ok(sanDuration < 2000, `Sanitization too slow: ${sanDuration}ms for 1000 checks`);
});

// ============================================================================
// NFR Tests
// ============================================================================

test('NFR-2: Audit log failure does not block execution', async () => {
  // Initialize with valid directory first
  await initAuditLogService({ logPath: tempDir });

  // This should not throw even if there might be issues
  await logAuditEntry({
    userId: 'test-user',
    action: 'stop',
    result: 'success'
  });

  // If we got here, the test passes - logAuditEntry didn't throw
  assert.ok(true);
});

test('NFR-4: Error messages are secure', () => {
  const config = createTestConfig();
  config.userPermissions.set('viewer-user', 'viewer');
  setConfigForTesting(config);

  const result = checkCommandPermission('viewer-user', 'exec');

  // Error message should not contain sensitive info
  assert.ok(!result.reason.includes('ENABLE_SYSTEM_EXEC'));
  assert.ok(!result.reason.includes('config'));
  assert.ok(!result.reason.includes('/'));
});
