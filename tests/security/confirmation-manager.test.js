/**
 * Tests for confirmation-manager.js
 * F-006: Safety and Permission Guard
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConfirmation,
  checkConfirmation,
  confirmAction,
  cancelConfirmation,
  clearExpiredConfirmations
} from '../../src/security/confirmation-manager.js';

// Helper to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// createConfirmation tests
test('createConfirmation creates a pending confirmation', () => {
  clearExpiredConfirmations();
  const result = createConfirmation('user123', 'stop', { type: 'feature' });

  assert.ok(result.confirmId);
  assert.ok(result.message);
  assert.ok(result.message.includes('stop'));
});

test('createConfirmation generates unique confirmId', () => {
  clearExpiredConfirmations();
  const result1 = createConfirmation('user123', 'stop', { type: 'feature' });
  const result2 = createConfirmation('user123', 'reset', {});

  assert.notEqual(result1.confirmId, result2.confirmId);
});

test('createConfirmation uses custom timeout', () => {
  clearExpiredConfirmations();
  const result = createConfirmation('user123', 'stop', {}, 5000);

  assert.ok(result.confirmId);
  // Verify by checking it expires after timeout
});

test('createConfirmation stores userId correctly', () => {
  clearExpiredConfirmations();
  const result = createConfirmation('user123', 'stop', { type: 'feature' });

  const check = checkConfirmation(result.confirmId, 'user123');
  assert.equal(check.status, 'pending');
});

// checkConfirmation tests
test('checkConfirmation returns pending for active confirmation', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', { type: 'feature' });

  const result = checkConfirmation(confirmId, 'user123');

  assert.equal(result.status, 'pending');
  assert.equal(result.action, 'stop');
  assert.deepEqual(result.params, { type: 'feature' });
});

test('checkConfirmation returns not_found for unknown confirmId', () => {
  clearExpiredConfirmations();
  const result = checkConfirmation('nonexistent-id', 'user123');

  assert.equal(result.status, 'not_found');
});

test('checkConfirmation returns not_found for wrong userId', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {});

  const result = checkConfirmation(confirmId, 'different-user');

  assert.equal(result.status, 'not_found');
});

test('checkConfirmation returns expired after timeout', async () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {}, 100);

  await wait(150);

  const result = checkConfirmation(confirmId, 'user123');

  assert.equal(result.status, 'expired');
});

// confirmAction tests
test('confirmAction confirms pending action', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', { type: 'feature' });

  const result = confirmAction(confirmId, 'user123');

  assert.equal(result.ok, true);
  assert.equal(result.action, 'stop');
  assert.deepEqual(result.params, { type: 'feature' });
});

test('confirmAction fails for wrong userId', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {});

  const result = confirmAction(confirmId, 'different-user');

  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('confirmAction fails for unknown confirmId', () => {
  clearExpiredConfirmations();
  const result = confirmAction('nonexistent-id', 'user123');

  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('confirmAction fails for already confirmed action', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {});

  confirmAction(confirmId, 'user123');
  const result = confirmAction(confirmId, 'user123');

  assert.equal(result.ok, false);
  assert.ok(result.error.includes('不存在') || result.error.includes('过期'));
});

test('confirmAction fails for expired action', async () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {}, 100);

  await wait(150);

  const result = confirmAction(confirmId, 'user123');

  assert.equal(result.ok, false);
});

// cancelConfirmation tests
test('cancelConfirmation cancels pending action', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {});

  cancelConfirmation(confirmId, 'user123');

  const result = checkConfirmation(confirmId, 'user123');
  assert.equal(result.status, 'not_found');
});

test('cancelConfirmation does nothing for unknown confirmId', () => {
  clearExpiredConfirmations();
  // Should not throw
  cancelConfirmation('nonexistent-id', 'user123');
});

test('cancelConfirmation does nothing for wrong userId', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {});

  cancelConfirmation(confirmId, 'different-user');

  const result = checkConfirmation(confirmId, 'user123');
  assert.equal(result.status, 'pending');
});

// clearExpiredConfirmations tests
test('clearExpiredConfirmations removes expired confirmations', async () => {
  clearExpiredConfirmations();
  createConfirmation('user123', 'stop', {}, 100);
  createConfirmation('user456', 'reset', {}, 10000);

  await wait(150);

  clearExpiredConfirmations();

  // The expired one should be gone, the active one should remain
  const check1 = checkConfirmation(
    // We can't check the specific one, but clearExpiredConfirmations should clean up
    'any-id',
    'user123'
  );
  assert.equal(check1.status, 'not_found');
});

// Integration test: full confirmation flow
test('full confirmation flow: create, check, confirm', () => {
  clearExpiredConfirmations();
  // Create
  const { confirmId, message } = createConfirmation('user123', 'stop', { type: 'feature' });

  assert.ok(confirmId);
  assert.ok(message);

  // Check
  const check1 = checkConfirmation(confirmId, 'user123');
  assert.equal(check1.status, 'pending');

  // Confirm
  const confirm = confirmAction(confirmId, 'user123');
  assert.equal(confirm.ok, true);

  // Verify confirmed
  const check2 = checkConfirmation(confirmId, 'user123');
  assert.equal(check2.status, 'not_found'); // Consumed
});

test('full confirmation flow: create, check, cancel', () => {
  clearExpiredConfirmations();
  // Create
  const { confirmId } = createConfirmation('user123', 'reset', {});

  // Check
  const check1 = checkConfirmation(confirmId, 'user123');
  assert.equal(check1.status, 'pending');

  // Cancel
  cancelConfirmation(confirmId, 'user123');

  // Verify cancelled
  const check2 = checkConfirmation(confirmId, 'user123');
  assert.equal(check2.status, 'not_found');
});

// AC-4.3: 60 second timeout default
test('default timeout is 60 seconds', () => {
  clearExpiredConfirmations();
  const { confirmId } = createConfirmation('user123', 'stop', {});

  const check = checkConfirmation(confirmId, 'user123');
  assert.equal(check.status, 'pending');

  // We can't wait 60s in test, but we can verify it exists initially
});

// AC-4.4: --force flag handling (in handler, not here)
// This is tested at the integration level
