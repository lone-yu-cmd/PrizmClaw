/**
 * Permission Guard Module
 * F-006: Safety and Permission Guard
 *
 * Provides user permission tiers and command authorization checking.
 */

import { config } from '../config.js';

/**
 * Role hierarchy levels (higher = more permissions)
 */
export const ROLE_HIERARCHY = {
  viewer: 0,
  operator: 1,
  admin: 2
};

/**
 * Minimum required role for each command
 */
const COMMAND_MIN_ROLE = {
  status: 'viewer',
  logs: 'viewer',
  commits: 'viewer',
  // F-009: cd and more commands
  cd: 'operator',
  more: 'viewer',
  // F-010: File Manager commands
  ls: 'viewer',
  tree: 'viewer',
  cat: 'viewer',
  head: 'viewer',
  tail: 'viewer',
  find: 'viewer',
  upload: 'operator',
  download: 'operator',
  // F-012: System Monitor commands
  sysinfo: 'viewer',
  ps: 'viewer',
  monitor: 'operator',
  kill: 'admin',
  pipeline: 'operator',
  bugfix: 'operator',
  planner: 'operator',
  retry: 'operator',
  commit: 'operator',
  stop: 'admin',
  reset: 'admin',
  'force-unlock': 'admin',
  exec: 'admin',
  'commit-amend': 'admin',
  'commit-force': 'admin'
};

/**
 * High-risk commands that require confirmation
 */
const HIGH_RISK_COMMANDS = new Set(['stop', 'reset', 'force-unlock', 'commit-amend', 'commit-force', 'kill']);

/**
 * Internal config reference - can be overridden for testing
 * @type {Object}
 */
let _config = config;

/**
 * Set config for testing purposes
 * @param {Object} testConfig
 */
export function setConfigForTesting(testConfig) {
  _config = testConfig;
}

/**
 * Reset config to original (for testing cleanup)
 */
export function resetConfig() {
  _config = config;
}

/**
 * Get user permission level
 * @param {string|number} userId - Telegram user ID
 * @returns {'admin'|'operator'|'viewer'}
 */
export function getUserRole(userId) {
  const userIdStr = String(userId);
  const configuredRole = _config.userPermissions.get(userIdStr);

  if (configuredRole) {
    return configuredRole;
  }

  // Default to operator for unknown users (AC-1.3)
  return 'operator';
}

/**
 * Check if user is admin
 * @param {string|number} userId
 * @returns {boolean}
 */
export function isAdmin(userId) {
  return getUserRole(userId) === 'admin';
}

/**
 * Check if user can execute command
 * @param {string|number} userId
 * @param {string} command - Command name
 * @returns {{ allowed: boolean, requiresConfirmation: boolean, reason?: string }}
 */
export function checkCommandPermission(userId, command) {
  const userRole = getUserRole(userId);
  const minRole = COMMAND_MIN_ROLE[command] || 'viewer';

  // Special handling for exec command (AC-2.4, F-002)
  if (command === 'exec' && !_config.enableSystemExec) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: '系统命令执行未启用。请在 .env 中设置 ENABLE_SYSTEM_EXEC=true。'
    };
  }

  // Check role hierarchy
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < requiredLevel) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `权限不足。此命令需要 ${minRole} 权限，当前权限: ${userRole}。`
    };
  }

  // Check if this is a high-risk command requiring confirmation
  const requiresConfirmation = HIGH_RISK_COMMANDS.has(command);

  return {
    allowed: true,
    requiresConfirmation
  };
}

export default {
  getUserRole,
  checkCommandPermission,
  isAdmin,
  ROLE_HIERARCHY,
  setConfigForTesting,
  resetConfig
};
