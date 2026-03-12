/**
 * CommitService Module
 * F-008: Commit Workflow Integration
 *
 * Orchestrates commit workflow: validation → execution → recording.
 * Coordinates GitService, StatusAggregator, and SessionStore.
 *
 * Design Decisions:
 * - D2: Pre-commit validation includes pipeline and test status checks
 * - D3: Commit records stored in session state file
 * - AC-5.3: All commit operations are logged to audit log
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {Array<*>} [errors]
 * @property {string[]} [warnings]
 * @property {*} [gitStatus]
 */

/**
 * @typedef {Object} CommitRecord
 * @property {string} hash
 * @property {string} message
 * @property {string} timestamp
 * @property {string} [sessionId]
 */

/**
 * @typedef {Object} CommitResult
 * @property {boolean} success
 * @property {string} [hash]
 * @property {string} [message]
 * @property {*} [error]
 * @property {*} [errors]
 * @property {*} [gitStatus]
 */

import fs from 'node:fs';
import path from 'node:path';

import { createGitService } from './git-service.js';
import { createStatusAggregator } from './status-aggregator.js';
import { logAuditEntry } from './audit-log-service.js';

/**
 * Validation error codes with messages and suggestions
 */
export const VALIDATION_ERRORS = {
  PIPELINE_RUNNING: {
    code: 'PIPELINE_RUNNING',
    message: 'Pipeline 正在运行中',
    suggestion: '请等待 pipeline 完成或使用 /stop 停止'
  },
  TEST_FAILED: {
    code: 'TEST_FAILED',
    message: '测试未通过',
    suggestion: '请检查测试结果或使用 --force 跳过（仅 admin）'
  },
  NOTHING_TO_COMMIT: {
    code: 'NOTHING_TO_COMMIT',
    message: '没有待提交的变更',
    suggestion: '请先进行代码修改'
  },
  MERGE_CONFLICT: {
    code: 'MERGE_CONFLICT',
    message: '存在合并冲突',
    suggestion: '请先解决以下冲突文件'
  }
};

/**
 * Default test status path
 */
const DEFAULT_TEST_STATUS_PATH = 'dev-pipeline/state/test-status.json';

/**
 * Get error suggestion by error code (standalone function)
 * @param {string} code - Error code
 * @returns {Object} Error with suggestion
 */
export function getErrorSuggestion(code) {
  return VALIDATION_ERRORS[code] || {
    code,
    message: '未知错误',
    suggestion: '请检查错误日志'
  };
}

/**
 * Create a CommitService instance
 * @param {Object} options - Configuration options
 * @param {Object} [options.gitService] - GitService instance
 * @param {Object} [options.statusAggregator] - StatusAggregator instance
 * @param {Object} [options.sessionStore] - SessionStore instance
 * @param {string} [options.testStatusPath] - Path to test status file
 * @param {string} [options.projectRoot] - Project root directory
 * @returns {Object} CommitService interface
 */
export function createCommitService(options = {}) {
  const gitService = options.gitService || createGitService({ baseDir: options.projectRoot });
  const statusAggregator = options.statusAggregator || createStatusAggregator();
  const sessionStore = options.sessionStore;
  const testStatusPath = options.testStatusPath || DEFAULT_TEST_STATUS_PATH;

  /**
   * Read test status from file
   * @returns {Object|null} Test status or null if file doesn't exist
   */
  function readTestStatus() {
    try {
      const fullPath = path.resolve(testStatusPath);
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Check pipeline status helper
   * @returns {Promise<{isRunning: boolean, phase: string}>}
   */
  async function checkPipelineStatus() {
    try {
      const featureStatus = await statusAggregator.aggregateStatus('feature');
      const bugfixStatus = await statusAggregator.aggregateStatus('bugfix');

      const isRunning = featureStatus.stage === 'running' || bugfixStatus.stage === 'running';
      const phase = featureStatus.stage === 'running' ? featureStatus.stage :
                    bugfixStatus.stage === 'running' ? bugfixStatus.stage : 'idle';

      return { isRunning, phase };
    } catch {
      return { isRunning: false, phase: 'unknown' };
    }
  }

  /**
   * Check test status helper
   * @returns {{passed: boolean, failed: number, total: number}}
   */
  function checkTestStatus() {
    const status = readTestStatus();

    if (!status) {
      return { passed: true, failed: 0, total: 0 };
    }

    return {
      passed: status.failed === 0,
      failed: status.failed || 0,
      total: (status.passed || 0) + (status.failed || 0) + (status.skipped || 0)
    };
  }

  /**
   * Validate pre-commit conditions
   * @param {Object} validationOptions - Validation options
   * @param {boolean} [validationOptions.skipPipelineCheck] - Skip pipeline status check
   * @param {boolean} [validationOptions.skipTestCheck] - Skip test status check
   * @returns {Promise<ValidationResult>}
   */
  async function validatePreConditions(validationOptions = {}) {
    const errors = [];
    const warnings = [];

    // 1. Check pipeline status
    if (!validationOptions.skipPipelineCheck) {
      const pipelineCheck = await checkPipelineStatus();
      if (pipelineCheck.isRunning) {
        errors.push({
          ...VALIDATION_ERRORS.PIPELINE_RUNNING,
          phase: pipelineCheck.phase
        });
      }
    }

    // 2. Check test status
    if (!validationOptions.skipTestCheck) {
      const testCheck = checkTestStatus();
      if (!testCheck.passed && testCheck.total > 0) {
        errors.push({
          ...VALIDATION_ERRORS.TEST_FAILED,
          failed: testCheck.failed,
          total: testCheck.total
        });
      }
    }

    // 3. Check git status
    const gitStatus = await gitService.getStatus();

    if (gitStatus.clean) {
      errors.push(VALIDATION_ERRORS.NOTHING_TO_COMMIT);
    }

    if (gitStatus.conflicts.length > 0) {
      errors.push({
        ...VALIDATION_ERRORS.MERGE_CONFLICT,
        files: gitStatus.conflicts
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      gitStatus
    };
  }

  /**
   * Build commit message with footer
   * @param {string} userMessage - User-provided commit message
   * @param {Object} context - Commit context
   * @param {string} [context.featureId] - Feature ID
   * @param {string} [context.bugfixId] - Bugfix ID
   * @returns {string} Full commit message
   */
  function buildCommitMessage(userMessage, context = {}) {
    const lines = [userMessage];

    if (context.featureId) {
      lines.push('');
      lines.push(`Feature: ${context.featureId}`);
    }

    if (context.bugfixId) {
      lines.push('');
      lines.push(`Bugfix: ${context.bugfixId}`);
    }

    return lines.join('\n');
  }

  /**
   * Record commit to session store
   * @param {string} sessionId - Session ID
   * @param {Object} commitInfo - Commit information
   */
  async function recordCommit(sessionId, commitInfo) {
    if (!sessionStore) {
      return;
    }

    const record = {
      hash: commitInfo.hash,
      shortHash: commitInfo.shortHash,
      message: commitInfo.message,
      timestamp: Date.now(),
      author: commitInfo.author || 'unknown',
      featureId: commitInfo.featureId || null,
      bugfixId: commitInfo.bugfixId || null,
      filesChanged: commitInfo.filesChanged || 0
    };

    if (typeof sessionStore.addCommit === 'function') {
      sessionStore.addCommit(sessionId, record);
    }
  }

  /**
   * Get commits for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<CommitRecord[]>}
   */
  async function getSessionCommits(sessionId) {
    if (!sessionStore) {
      return [];
    }

    if (typeof sessionStore.getCommits === 'function') {
      return sessionStore.getCommits(sessionId);
    }

    return [];
  }

  /**
   * Main commit function
   * @param {Object} params - Commit parameters
   * @param {string} params.sessionId - Session ID
   * @param {string} params.userId - User ID
   * @param {string} [params.message] - Commit message
   * @param {boolean} [params.amend] - Whether to amend last commit
   * @param {boolean} [params.force] - Skip validation
   * @param {string} [params.featureId] - Feature ID
   * @param {string} [params.bugfixId] - Bugfix ID
   * @param {string} [params.userRole] - User role for audit log
   * @returns {Promise<CommitResult>}
   */
  async function commit(params) {
    try {
      const {
        sessionId,
        userId,
        message = 'chore: commit',
        amend = false,
        force = false,
        featureId,
        bugfixId,
        userRole = 'operator'
      } = params;

      // Validate pre-conditions (unless force is true)
      if (!force) {
        let validation;
        try {
          validation = await validatePreConditions({});
        } catch (validationErr) {
          // Log validation error to audit trail
          try {
            await logAuditEntry({
              userId,
              role: userRole,
              action: amend ? 'commit:amend' : 'commit',
              params: { message, featureId, bugfixId, force },
              result: 'error',
              reason: `Validation error: ${validationErr.message}`,
              sessionId
            });
          } catch (auditErr) {
            // Audit log failure should not block the error response
          }

          return {
            success: false,
            error: validationErr.message,
            errors: [{
              code: 'VALIDATION_FAILED',
              message: 'Pre-commit validation failed',
              originalError: validationErr.message
            }]
          };
        }

        if (!validation.valid) {
          // Log failed commit attempt (AC-5.3)
          try {
            await logAuditEntry({
              userId,
              role: userRole,
              action: amend ? 'commit:amend' : 'commit',
              params: { message, featureId, bugfixId, force },
              result: 'denied',
              reason: validation.errors.map(e => e.code).join(', '),
              sessionId
            });
          } catch (auditErr) {
            // Audit log failure should not block the validation error response
          }

          return {
            success: false,
            errors: validation.errors,
            gitStatus: validation.gitStatus
          };
        }
      }

      // Build full commit message
      const fullMessage = buildCommitMessage(message, { featureId, bugfixId });

      // Execute commit
      let result;
      try {
        if (amend) {
          result = await gitService.amendCommit(fullMessage);
        } else {
          result = await gitService.commit(fullMessage);
        }
      } catch (gitErr) {
        // Log git operation error to audit trail
        try {
          await logAuditEntry({
            userId,
            role: userRole,
            action: amend ? 'commit:amend' : 'commit',
            params: { message: fullMessage, featureId, bugfixId, force },
            result: 'error',
            reason: `Git error: ${gitErr.message}`,
            sessionId
          });
        } catch (auditErr) {
          // Audit log failure should not block the error response
        }

        return {
          success: false,
          error: gitErr.message,
          errors: [{
            code: 'GIT_ERROR',
            message: 'Git operation failed',
            originalError: gitErr.message
          }]
        };
      }

      // Record commit to session (if successful)
      if (result.success) {
        try {
          await recordCommit(sessionId, {
            hash: result.hash,
            shortHash: result.shortHash,
            message: fullMessage,
            author: userId,
            featureId,
            bugfixId,
            filesChanged: result.filesChanged
          });
        } catch (recordErr) {
          // Log recording error but don't fail the commit result
          try {
            await logAuditEntry({
              userId,
              role: userRole,
              action: amend ? 'commit:amend' : 'commit',
              params: { message: fullMessage, featureId, bugfixId, force },
              result: 'warning',
              reason: `Commit succeeded but session recording failed: ${recordErr.message}`,
              sessionId
            });
          } catch (auditErr) {
            // Audit log failure should not block the response
          }
        }

        // Log successful commit (AC-5.3)
        try {
          await logAuditEntry({
            userId,
            role: userRole,
            action: amend ? 'commit:amend' : 'commit',
            params: { message: fullMessage, featureId, bugfixId, force },
            result: 'success',
            sessionId
          });
        } catch (auditErr) {
          // Audit log failure should not block the successful commit response
        }
      } else {
        // Log failed commit (AC-5.3)
        try {
          await logAuditEntry({
            userId,
            role: userRole,
            action: amend ? 'commit:amend' : 'commit',
            params: { message: fullMessage, featureId, bugfixId, force },
            result: 'failed',
            reason: result.error,
            sessionId
          });
        } catch (auditErr) {
          // Audit log failure should not block the error response
        }
      }

      return result;
    } catch (err) {
      // Catch-all for unexpected errors
      return {
        success: false,
        error: err.message,
        errors: [{
          code: 'INTERNAL_ERROR',
          message: 'Unexpected error during commit operation',
          originalError: err.message
        }]
      };
    }
  }

  return {
    validatePreConditions,
    commit,
    recordCommit,
    getSessionCommits,
    checkPipelineStatus,
    checkTestStatus,
    buildCommitMessage,
    getErrorSuggestion
  };
}

export default createCommitService;
