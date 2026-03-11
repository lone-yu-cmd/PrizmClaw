/**
 * Lock Manager
 *
 * F-004: Pipeline Process Controller - US-7 Concurrency Protection
 *
 * Provides file-based lock management with PID validation for preventing
 * concurrent pipeline operations of the same type.
 *
 * Design Decisions:
 * - D1: File lock + PID validation (no external dependencies)
 * - Atomic write via temp file + rename
 * - Stale lock cleanup when holder process is dead
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadPipelineInfraConfig } from './config-loader.js';
import { getStatePaths } from './path-policy.js';

/**
 * @typedef {'feature' | 'bugfix'} PipelineType
 */

/**
 * @typedef {Object} LockInfo
 * @property {number} pid - Process ID holding the lock
 * @property {string} acquiredAt - ISO timestamp when lock was acquired
 * @property {PipelineType} type - Pipeline type
 * @property {string} hostname - Hostname where lock was acquired
 */

/**
 * @typedef {Object} LockResult
 * @property {boolean} ok - Whether operation succeeded
 * @property {string} lockPath - Path to lock file
 * @property {string} [errorCode] - Error code if failed
 * @property {LockInfo} [currentHolder] - Current lock holder if locked
 */

/**
 * Check if a process is alive.
 * @param {number} pid - Process ID to check
 * @returns {boolean} True if process is alive
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

/**
 * Create a lock manager instance.
 * @param {Object} [options] - Options
 * @param {Object} [options.config] - Pipeline config (will load if not provided)
 * @returns {Object} Lock manager instance
 */
export function createLockManager(options = {}) {
  const config = options.config ?? loadPipelineInfraConfig();

  /**
   * Get lock file path for pipeline type.
   * @param {PipelineType} type - Pipeline type
   * @returns {string} Lock file path
   */
  function getLockPath(type) {
    const paths = getStatePaths(config.projectRoot, type);
    return paths.lockFile;
  }

  /**
   * Read lock file if exists.
   * @param {PipelineType} type - Pipeline type
   * @returns {LockInfo | null} Lock info or null
   */
  function readLockFile(type) {
    const lockPath = getLockPath(type);
    try {
      const content = fs.readFileSync(lockPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Write lock file atomically.
   * @param {PipelineType} type - Pipeline type
   * @param {LockInfo} lockInfo - Lock info to write
   * @returns {string} Lock file path
   */
  function writeLockFile(type, lockInfo) {
    const lockPath = getLockPath(type);
    const dir = path.dirname(lockPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temp file first, then rename for atomicity
    const tempPath = `${lockPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(lockInfo, null, 2));
    fs.renameSync(tempPath, lockPath);

    return lockPath;
  }

  /**
   * Remove lock file.
   * @param {PipelineType} type - Pipeline type
   */
  function removeLockFile(type) {
    const lockPath = getLockPath(type);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Acquire lock for pipeline type.
   * @param {PipelineType} type - Pipeline type
   * @param {number} [pid] - PID to use (default: process.pid)
   * @returns {Promise<LockResult>} Lock result
   */
  async function acquireLock(type, pid = process.pid) {
    const lockPath = getLockPath(type);

    // Check existing lock
    const existingLock = readLockFile(type);
    if (existingLock) {
      // Check if holder is still alive
      if (isProcessAlive(existingLock.pid)) {
        return {
          ok: false,
          lockPath,
          errorCode: 'LOCK_ACQUISITION_FAILED',
          currentHolder: existingLock
        };
      }
      // Stale lock - will be cleaned up below
    }

    // Acquire lock
    const lockInfo = {
      pid,
      acquiredAt: new Date().toISOString(),
      type,
      hostname: os.hostname()
    };

    try {
      writeLockFile(type, lockInfo);
      return { ok: true, lockPath };
    } catch (error) {
      return {
        ok: false,
        lockPath,
        errorCode: 'LOCK_ACQUISITION_FAILED'
      };
    }
  }

  /**
   * Release lock for pipeline type.
   * @param {PipelineType} type - Pipeline type
   * @param {number} [pid] - PID that holds the lock (default: process.pid)
   * @returns {Promise<{ok: boolean}>} Release result
   */
  async function releaseLock(type, pid = process.pid) {
    const existingLock = readLockFile(type);

    // Only release if we own the lock
    if (existingLock && existingLock.pid === pid) {
      removeLockFile(type);
    }

    return { ok: true };
  }

  /**
   * Check if lock is held for pipeline type.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<boolean>} True if locked
   */
  async function isLocked(type) {
    const lockInfo = readLockFile(type);
    if (!lockInfo) {
      return false;
    }
    return isProcessAlive(lockInfo.pid);
  }

  /**
   * Validate lock and return lock info.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<LockInfo | null>} Lock info if valid, null otherwise
   */
  async function validateLock(type) {
    const lockInfo = readLockFile(type);
    if (!lockInfo) {
      return null;
    }
    if (!isProcessAlive(lockInfo.pid)) {
      return null;
    }
    return lockInfo;
  }

  /**
   * Force unlock for pipeline type (admin operation).
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<{ok: boolean, previousPid?: number}>} Force unlock result
   */
  async function forceUnlock(type) {
    const lockInfo = readLockFile(type);
    const previousPid = lockInfo?.pid;
    removeLockFile(type);
    return { ok: true, previousPid };
  }

  /**
   * Get lock info for pipeline type.
   * @param {PipelineType} type - Pipeline type
   * @returns {Promise<LockInfo | null>} Lock info or null
   */
  async function getLockInfo(type) {
    return readLockFile(type);
  }

  return {
    acquireLock,
    releaseLock,
    isLocked,
    validateLock,
    forceUnlock,
    getLockInfo
  };
}

// Default instance
let defaultManager = null;

/**
 * Get default lock manager instance.
 * @returns {Object} Default lock manager
 */
export function getDefaultLockManager() {
  if (!defaultManager) {
    defaultManager = createLockManager();
  }
  return defaultManager;
}
