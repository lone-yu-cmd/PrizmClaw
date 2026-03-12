/**
 * Command Executor Service
 * F-009: General Command Executor
 *
 * Main service for executing shell commands with:
 * - Blacklist checking
 * - High-risk keyword detection
 * - Confirmation flow for dangerous commands
 * - Session working directory support
 * - Output pagination
 * - Audit logging
 */

import { config } from '../config.js';
import { sessionStore } from './session-store.js';
import { executeSystemCommand } from './system-exec-service.js';
import { checkCommandBlacklist, detectHighRiskKeywords } from '../security/system-guard.js';
import { createConfirmation, confirmAction } from '../security/confirmation-manager.js';
import { logAuditEntry } from './audit-log-service.js';
import { paginateOutput, storeOutputPages, hasMorePages } from './output-pager-service.js';
import { getUserRole } from '../security/permission-guard.js';

/**
 * Execute a command with full security checks and pagination.
 * @param {Object} options - Execution options
 * @param {string} options.command - Command to execute
 * @param {string} options.sessionId - Session identifier
 * @param {string|number} options.userId - User ID for audit and permissions
 * @param {boolean} [options.skipConfirmation=false] - Skip confirmation (for confirmed commands)
 * @param {string} [options.confirmationId] - Confirmation ID if this is a confirmed execution
 * @returns {Promise<Object>} Execution result
 */
export async function executeCommand(options) {
  const { command, sessionId, userId, skipConfirmation = false, confirmationId } = options;

  // Check blacklist first
  const blacklistResult = checkCommandBlacklist(command, config.commandBlacklist);
  if (blacklistResult.blocked) {
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'exec',
      params: { command },
      result: 'denied',
      reason: `Blacklisted command: ${blacklistResult.matchedCommand}`,
      sessionId
    });

    throw new Error(`命令被拒绝：${blacklistResult.reason}`);
  }

  // Detect high-risk keywords
  const riskResult = detectHighRiskKeywords(command, config.highRiskKeywords);

  // If high-risk and not confirmed, require confirmation
  if (riskResult.isHighRisk && !skipConfirmation && !confirmationId) {
    const params = { command, sessionId };
    const { confirmId, message } = createConfirmation(userId, 'exec', params);

    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'exec',
      params: { command },
      result: 'pending_confirmation',
      reason: `High-risk keywords: ${riskResult.detectedKeywords.join(', ')}`,
      sessionId
    });

    return {
      needsConfirmation: true,
      confirmationId: confirmId,
      confirmationMessage: message,
      detectedKeywords: riskResult.detectedKeywords
    };
  }

  // If confirmation ID provided, verify it
  if (confirmationId) {
    const confirmResult = confirmAction(confirmationId, userId);
    if (!confirmResult.ok) {
      throw new Error(`确认失败：${confirmResult.error}`);
    }
  }

  // Get session cwd
  const cwd = sessionStore.getCwd(sessionId) || process.cwd();

  // Execute the command
  let result;
  try {
    result = await executeSystemCommand(command, { cwd });
  } catch (error) {
    await logAuditEntry({
      userId,
      role: getUserRole(userId),
      action: 'exec',
      params: { command, cwd },
      result: 'failed',
      reason: error.message,
      sessionId
    });
    throw error;
  }

  // Format output
  const output = formatOutput(result);

  // Paginate if needed
  const pages = paginateOutput(output);
  const displayOutput = pages[0];

  // Store remaining pages for /more
  if (pages.length > 1) {
    storeOutputPages(sessionId, pages.slice(1));
  }

  // Log successful execution
  await logAuditEntry({
    userId,
    role: getUserRole(userId),
    action: 'exec',
    params: { command, cwd },
    result: 'success',
    sessionId
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    output: displayOutput,
    hasMorePages: hasMorePages(sessionId),
    needsConfirmation: false
  };
}

/**
 * Confirm and execute a high-risk command.
 * @param {string} confirmationId - Confirmation ID from previous executeCommand call
 * @param {string|number} userId - User ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Execution result
 */
export async function confirmHighRiskCommand(confirmationId, userId, sessionId) {
  const confirmResult = confirmAction(confirmationId, userId);

  if (!confirmResult.ok) {
    throw new Error(`确认失败：${confirmResult.error}`);
  }

  const { params } = confirmResult;
  return executeCommand({
    command: params.command,
    sessionId: params.sessionId || sessionId,
    userId,
    skipConfirmation: true
  });
}

/**
 * Format command output for display.
 * @param {Object} result - Execution result
 * @returns {string} Formatted output
 */
function formatOutput(result) {
  const parts = [];

  if (result.timedOut) {
    parts.push(`⚠️ 命令执行超时，已终止进程。`);
  }

  parts.push(`exitCode: ${result.exitCode}`);

  if (result.stdout) {
    parts.push(`stdout:\n${result.stdout}`);
  } else {
    parts.push(`stdout: (empty)`);
  }

  if (result.stderr) {
    parts.push(`stderr:\n${result.stderr}`);
  } else {
    parts.push(`stderr: (empty)`);
  }

  return parts.join('\n\n');
}

export default {
  executeCommand,
  confirmHighRiskCommand
};
