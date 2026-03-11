/**
 * Confirmation Manager Module
 * F-006: Safety and Permission Guard
 *
 * Manages confirmation flow for high-risk actions.
 * AC-4: Confirmation for Sensitive Actions
 */

import { randomUUID } from 'node:crypto';

/**
 * Default confirmation timeout (60 seconds per AC-4.3)
 */
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Pending confirmations storage
 * Map<confirmId, ConfirmationEntry>
 */
const pendingConfirmations = new Map();

/**
 * @typedef {Object} ConfirmationEntry
 * @property {string} confirmId
 * @property {string|number} userId
 * @property {string} action
 * @property {Object} params
 * @property {number} createdAt
 * @property {number} expiresAt
 */

/**
 * Create pending confirmation
 * @param {string|number} userId
 * @param {string} action - Action name
 * @param {Object} params - Action parameters
 * @param {number} [timeoutMs=60000]
 * @returns {{ confirmId: string, message: string }}
 */
export function createConfirmation(userId, action, params, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const confirmId = randomUUID();
  const now = Date.now();

  const entry = {
    confirmId,
    userId: String(userId),
    action,
    params,
    createdAt: now,
    expiresAt: now + timeoutMs
  };

  pendingConfirmations.set(confirmId, entry);

  const message = `⚠️ 确认执行操作: ${action}\n参数: ${JSON.stringify(params)}\n请在 60 秒内回复 CONFIRM 确认，或回复 CANCEL 取消。`;

  return { confirmId, message };
}

/**
 * Check confirmation status
 * @param {string} confirmId
 * @param {string|number} userId
 * @returns {{ status: 'pending'|'confirmed'|'expired'|'not_found', action?: string, params?: Object }}
 */
export function checkConfirmation(confirmId, userId) {
  const entry = pendingConfirmations.get(confirmId);

  if (!entry) {
    return { status: 'not_found' };
  }

  // Verify userId matches
  if (entry.userId !== String(userId)) {
    return { status: 'not_found' };
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    return { status: 'expired', action: entry.action, params: entry.params };
  }

  return {
    status: 'pending',
    action: entry.action,
    params: entry.params
  };
}

/**
 * Confirm pending action
 * @param {string} confirmId
 * @param {string|number} userId
 * @returns {{ ok: boolean, action?: string, params?: Object, error?: string }}
 */
export function confirmAction(confirmId, userId) {
  const entry = pendingConfirmations.get(confirmId);

  if (!entry) {
    return { ok: false, error: '确认请求不存在或已过期' };
  }

  // Verify userId matches
  if (entry.userId !== String(userId)) {
    return { ok: false, error: '无权确认此操作' };
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    return { ok: false, error: '确认请求已过期' };
  }

  // Remove from pending (consumed)
  pendingConfirmations.delete(confirmId);

  return {
    ok: true,
    action: entry.action,
    params: entry.params
  };
}

/**
 * Cancel pending confirmation
 * @param {string} confirmId
 * @param {string|number} userId
 */
export function cancelConfirmation(confirmId, userId) {
  const entry = pendingConfirmations.get(confirmId);

  if (!entry) {
    return;
  }

  // Only allow creator to cancel
  if (entry.userId === String(userId)) {
    pendingConfirmations.delete(confirmId);
  }
}

/**
 * Clear all expired confirmations
 * Should be called periodically
 */
export function clearExpiredConfirmations() {
  const now = Date.now();

  for (const [confirmId, entry] of pendingConfirmations) {
    if (entry.expiresAt <= now) {
      pendingConfirmations.delete(confirmId);
    }
  }
}

export default {
  createConfirmation,
  checkConfirmation,
  confirmAction,
  cancelConfirmation,
  clearExpiredConfirmations
};
