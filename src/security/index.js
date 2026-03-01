/**
 * Security Module Exports
 * Central exports for all security-related utilities.
 */

// Existing guards
export { isAllowedUser, sanitizeInput } from './guard.js';
export { assertSystemExecEnabled, assertAllowedCommand } from './system-guard.js';

// Permission Guard (F-006)
export { getUserRole, checkCommandPermission, isAdmin, ROLE_HIERARCHY } from './permission-guard.js';

// Param Sanitizer (F-006)
export { sanitizeParam, validatePath, detectDangerousPatterns } from './param-sanitizer.js';

// Confirmation Manager (F-006)
export {
  createConfirmation,
  checkConfirmation,
  confirmAction,
  cancelConfirmation,
  clearExpiredConfirmations
} from './confirmation-manager.js';
