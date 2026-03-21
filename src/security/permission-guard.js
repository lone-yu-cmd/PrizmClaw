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
  // F-013: Session and Context Manager commands
  history: 'viewer',
  alias: 'operator',
  sessions: 'admin',
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
  'commit-force': 'admin',
  // F-017: Runtime Config Manager command
  config: 'admin',
  cfg: 'admin',
  settings: 'admin'
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

  // Default to admin for unknown users (open-by-default mode)
  return 'admin';
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
