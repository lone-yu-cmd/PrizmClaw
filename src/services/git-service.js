/**
 * GitService Module
 * F-008: Commit Workflow Integration
 *
 * Wraps simple-git library for git operations.
 * Provides typed interfaces for commit workflow.
 *
 * Design Decisions:
 * - D1: Use simple-git to avoid shell injection risks
 * - D5: Design for mockability in tests
 */

/**
 * @typedef {Object} GitStatus
 * @property {boolean} [clean]
 * @property {string[]} [staged]
 * @property {string[]} [modified]
 * @property {string[]} [untracked]
 * @property {string[]} [conflicts]
 * @property {number} [ahead]
 * @property {number} [behind]
 * @property {string} [currentBranch]
 */

/**
 * @typedef {Object} CommitResult
 * @property {boolean} [success]
 * @property {string} [hash]
 * @property {string} [shortHash]
 * @property {string} [message]
 * @property {*} [error]
 * @property {string} [code]
 * @property {string} [suggestion]
 * @property {string[]} [conflicts]
 * @property {number} [filesChanged]
 */

/**
 * @typedef {Object} CommitInfo
 * @property {string} [hash]
 * @property {string} [shortHash]
 * @property {string} [message]
 * @property {string} [author]
 * @property {string} [date]
 */

// @ts-ignore — simple-git default export is callable at runtime
import simpleGit from 'simple-git';

/**
 * Validation error codes with messages and suggestions
 */
export const GIT_ERRORS = {
  NOTHING_TO_COMMIT: {
    code: 'NOTHING_TO_COMMIT',
    message: '没有待提交的变更',
    suggestion: '请先进行代码修改'
  },
  MERGE_CONFLICT: {
    code: 'MERGE_CONFLICT',
    message: '存在合并冲突',
    suggestion: '请先解决冲突文件'
  },
  COMMIT_FAILED: {
    code: 'COMMIT_FAILED',
    message: '提交失败',
    suggestion: '请检查 git 状态'
  },
  AMEND_FAILED: {
    code: 'AMEND_FAILED',
    message: '修改提交失败',
    suggestion: '请确认有提交可修改'
  }
};

/**
 * Create a GitService instance
 * @param {Object} options - Configuration options
 * @param {string} [options.baseDir] - Base directory for git operations
 * @param {Object} [options.git] - Custom simple-git instance (for testing)
 * @returns {Object} GitService interface
 */
export function createGitService(options = {}) {
  const baseDir = options.baseDir || process.cwd();
  // @ts-ignore — simple-git default export is callable at runtime
  const git = options.git || simpleGit(baseDir);

  /**
   * Get git working directory status
   * @returns {Promise<GitStatus>}
   */
  async function getStatus() {
    const status = await git.status();

    return {
      clean: status.isClean(),
      staged: status.staged,
      modified: status.modified,
      untracked: status.not_added,
      conflicts: status.conflicted,
      ahead: status.ahead,
      behind: status.behind,
      currentBranch: status.current
    };
  }

  /**
   * Check if working directory is clean
   * @returns {Promise<boolean>}
   */
  async function isClean() {
    const status = await git.status();
    return status.isClean();
  }

  /**
   * Get list of changed files
   * @returns {Promise<string[]>}
   */
  async function getChangedFiles() {
    const status = await git.status();
    return [
      ...status.staged,
      ...status.modified,
      ...status.not_added,
      ...status.conflicted
    ];
  }

  /**
   * Execute a git commit
   * @param {string} message - Commit message
   * @param {Object} [commitOptions] - Commit options
   * @param {boolean} [commitOptions.amend] - Whether to amend last commit
   * @param {boolean} [commitOptions.allowEmpty] - Allow empty commit
   * @returns {Promise<CommitResult>}
   */
  async function commit(message, commitOptions = {}) {
    try {
      const status = await git.status();

      // Check for nothing to commit
      if (status.isClean() && !commitOptions.allowEmpty) {
        return {
          success: false,
          error: GIT_ERRORS.NOTHING_TO_COMMIT.message,
          code: GIT_ERRORS.NOTHING_TO_COMMIT.code,
          suggestion: GIT_ERRORS.NOTHING_TO_COMMIT.suggestion
        };
      }

      // Check for conflicts
      if (status.conflicted.length > 0) {
        return {
          success: false,
          error: GIT_ERRORS.MERGE_CONFLICT.message,
          code: GIT_ERRORS.MERGE_CONFLICT.code,
          suggestion: `${GIT_ERRORS.MERGE_CONFLICT.suggestion}: ${status.conflicted.join(', ')}`,
          conflicts: status.conflicted
        };
      }

      // Build commit options
      const gitOptions = [];
      if (commitOptions.amend) {
        gitOptions.push('--amend');
      }
      if (commitOptions.allowEmpty) {
        gitOptions.push('--allow-empty');
      }

      // Execute commit
      const result = await git.commit(message, gitOptions);

      if (!result.commit) {
        return {
          success: false,
          error: GIT_ERRORS.COMMIT_FAILED.message,
          code: GIT_ERRORS.COMMIT_FAILED.code,
          suggestion: GIT_ERRORS.COMMIT_FAILED.suggestion
        };
      }

      return {
        success: true,
        hash: result.commit,
        shortHash: getShortHash(result.commit),
        message: message,
        filesChanged: result.summary.changes || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: GIT_ERRORS.COMMIT_FAILED.suggestion
      };
    }
  }

  /**
   * Amend the last commit
   * @param {string} message - New commit message
   * @returns {Promise<CommitResult>}
   */
  async function amendCommit(message) {
    try {
      const result = await git.commit(message, ['--amend', '--no-edit']);

      if (!result.commit) {
        // Amend without changes might return same hash
        const lastCommit = await getLastCommit();
        return {
          success: true,
          hash: lastCommit.hash,
          shortHash: lastCommit.shortHash,
          message: message,
          filesChanged: 0
        };
      }

      return {
        success: true,
        hash: result.commit,
        shortHash: getShortHash(result.commit),
        message: message,
        filesChanged: result.summary.changes || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: GIT_ERRORS.AMEND_FAILED.code,
        suggestion: GIT_ERRORS.AMEND_FAILED.suggestion
      };
    }
  }

  /**
   * Get the last commit info
   * @returns {Promise<CommitInfo>}
   */
  async function getLastCommit() {
    const log = await git.log(['-1']);
    const latest = log.latest;

    if (!latest) {
      return null;
    }

    return {
      hash: latest.hash,
      shortHash: getShortHash(latest.hash),
      message: latest.message,
      author: latest.author_name,
      date: latest.date
    };
  }

  /**
   * Get commit history
   * @param {number} [count=10] - Number of commits to retrieve
   * @returns {Promise<CommitInfo[]>}
   */
  async function getCommitLog(count = 10) {
    const log = await git.log([`-${count}`]);

    return log.all.map(commit => ({
      hash: commit.hash,
      shortHash: getShortHash(commit.hash),
      message: commit.message,
      author: commit.author_name,
      date: commit.date
    }));
  }

  /**
   * Get short hash from full hash
   * @param {string} hash - Full commit hash
   * @returns {string} 7-character short hash
   */
  function getShortHash(hash) {
    return hash ? hash.substring(0, 7) : '';
  }

  return {
    getStatus,
    isClean,
    getChangedFiles,
    commit,
    amendCommit,
    getLastCommit,
    getCommitLog,
    getShortHash
  };
}

export default createGitService;
