/**
 * Audit Log Service
 *
 * F-006: Safety and Permission Guard - US-5: Audit Logging
 *
 * Handles writing and querying audit logs for sensitive operations.
 * Uses JSON Lines format for log entries with rotation support.
 *
 * Design Decisions:
 * - D3: JSON Lines format for easy parsing and append operations
 * - Async write to avoid blocking command execution
 * - Log rotation based on file size with configurable retention
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { once } from 'node:events';

import { config } from '../config.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  logPath: 'logs',
  maxSizeMb: 10,
  maxFiles: 5
};

/**
 * Log file name
 */
const LOG_FILE_NAME = 'audit.log';

/**
 * Internal state
 * @type {{ initialized: boolean, logPath: string, maxSizeBytes: number, maxFiles: number }}
 */
let _state = {
  initialized: false,
  logPath: DEFAULT_CONFIG.logPath,
  maxSizeBytes: DEFAULT_CONFIG.maxSizeMb * 1024 * 1024,
  maxFiles: DEFAULT_CONFIG.maxFiles
};

/**
 * Reference to config for testing override
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
 * Initialize audit log service
 * @param {Object} options - Configuration options
 * @param {string} [options.logPath] - Log directory path (defaults to config.auditLogDir)
 * @param {number} [options.maxSizeMb] - Max size in MB before rotation (defaults to config.auditLogMaxSizeMb)
 * @param {number} [options.maxFiles] - Max rotated files to keep (defaults to config.auditLogMaxFiles)
 */
export function initAuditLogService(options = {}) {
  _state.logPath = options.logPath || _config.auditLogDir || DEFAULT_CONFIG.logPath;
  _state.maxSizeBytes = (options.maxSizeMb || _config.auditLogMaxSizeMb || DEFAULT_CONFIG.maxSizeMb) * 1024 * 1024;
  _state.maxFiles = options.maxFiles || _config.auditLogMaxFiles || DEFAULT_CONFIG.maxFiles;

  // Create log directory if it doesn't exist
  if (!fs.existsSync(_state.logPath)) {
    fs.mkdirSync(_state.logPath, { recursive: true });
  }

  _state.initialized = true;
}

/**
 * Reset the audit log service state (for testing)
 */
export function resetAuditLogService() {
  _state = {
    initialized: false,
    logPath: DEFAULT_CONFIG.logPath,
    maxSizeBytes: DEFAULT_CONFIG.maxSizeMb * 1024 * 1024,
    maxFiles: DEFAULT_CONFIG.maxFiles
  };
}

/**
 * Get the current log file path
 * @returns {string}
 */
function getLogFilePath() {
  return path.join(_state.logPath, LOG_FILE_NAME);
}

/**
 * Check if log rotation is needed
 * @returns {boolean}
 */
function needsRotation() {
  const logFile = getLogFilePath();
  if (!fs.existsSync(logFile)) {
    return false;
  }
  const stats = fs.statSync(logFile);
  return stats.size >= _state.maxSizeBytes;
}

/**
 * Perform log rotation
 * Rotates audit.log -> audit.log.1, audit.log.1 -> audit.log.2, etc.
 */
function rotateLog() {
  const logFile = getLogFilePath();

  // Remove oldest file if at max files
  const oldestFile = `${logFile}.${_state.maxFiles}`;
  if (fs.existsSync(oldestFile)) {
    fs.unlinkSync(oldestFile);
  }

  // Rotate existing files
  for (let i = _state.maxFiles - 1; i >= 1; i--) {
    const currentFile = `${logFile}.${i}`;
    const nextFile = `${logFile}.${i + 1}`;
    if (fs.existsSync(currentFile)) {
      fs.renameSync(currentFile, nextFile);
    }
  }

  // Rotate current log to .1
  if (fs.existsSync(logFile)) {
    fs.renameSync(logFile, `${logFile}.1`);
  }
}

/**
 * Log a sensitive action to the audit log
 * @param {Object} entry - Audit entry
 * @param {string|number} entry.userId - User ID
 * @param {string} [entry.role] - User role
 * @param {string} entry.action - Action name
 * @param {Object} [entry.params] - Action parameters
 * @param {string} entry.result - Result: 'success'|'denied'|'failed'
 * @param {string} [entry.reason] - Reason for denial/failure
 * @param {string} [entry.sessionId] - Session identifier
 * @returns {Promise<void>}
 */
export async function logAuditEntry(entry) {
  // Initialize with defaults if not already done
  if (!_state.initialized) {
    initAuditLogService();
  }

  const logFile = getLogFilePath();

  // Check for rotation before writing
  if (needsRotation()) {
    rotateLog();
  }

  // Build log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId: String(entry.userId),
    role: entry.role || 'unknown',
    action: entry.action,
    params: entry.params || {},
    result: entry.result,
    reason: entry.reason || null,
    sessionId: entry.sessionId || null
  };

  // Write as JSON line
  const line = JSON.stringify(logEntry) + '\n';

  try {
    // Use appendFileSync for simplicity (async write could be added for performance)
    // For true async, we could use fs.promises.appendFile
    await fs.promises.appendFile(logFile, line, 'utf8');
  } catch (error) {
    // Log write failure should not block execution (NFR-2)
    console.error('[AuditLog] Failed to write audit entry:', error.message);
  }
}

/**
 * Query audit logs with filters
 * @param {Object} filters - Query filters
 * @param {string|number} [filters.userId] - Filter by user ID
 * @param {string} [filters.action] - Filter by action name
 * @param {Date} [filters.startDate] - Filter entries after this date
 * @param {Date} [filters.endDate] - Filter entries before this date
 * @param {number} [filters.limit=100] - Maximum entries to return
 * @returns {Promise<Object[]>} Array of matching audit entries
 */
export async function queryAuditLogs(filters = {}) {
  // Initialize with defaults if not already done
  if (!_state.initialized) {
    initAuditLogService();
  }

  const logFile = getLogFilePath();

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const limit = filters.limit || 100;
  const userId = filters.userId != null ? String(filters.userId) : null;
  const action = filters.action || null;
  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : null;

  const entries = [];

  // Read log file(s) - start with current, then rotated files
  const filesToRead = [logFile];

  // Add rotated files
  for (let i = 1; i <= _state.maxFiles; i++) {
    const rotatedFile = `${logFile}.${i}`;
    if (fs.existsSync(rotatedFile)) {
      filesToRead.push(rotatedFile);
    }
  }

  // Read and parse entries
  for (const file of filesToRead) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Apply filters
          if (userId && String(entry.userId) !== userId) continue;
          if (action && entry.action !== action) continue;

          if (startDate || endDate) {
            const entryDate = new Date(entry.timestamp);
            if (startDate && entryDate < startDate) continue;
            if (endDate && entryDate > endDate) continue;
          }

          entries.push(entry);
        } catch {
          // Skip malformed entries (corrupted lines)
          continue;
        }
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  // Sort by timestamp descending (most recent first)
  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Apply limit
  return entries.slice(0, limit);
}

/**
 * Get audit log statistics
 * @returns {Promise<{ totalEntries: number, fileSize: number, oldestEntry: Date | null }>}
 */
export async function getAuditLogStats() {
  // Initialize with defaults if not already done
  if (!_state.initialized) {
    initAuditLogService();
  }

  const logFile = getLogFilePath();
  let totalEntries = 0;
  let fileSize = 0;
  let oldestEntry = null;

  if (fs.existsSync(logFile)) {
    const stats = fs.statSync(logFile);
    fileSize = stats.size;

    try {
      const content = await fs.promises.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      totalEntries = lines.length;

      // Find oldest entry (first line in file)
      if (lines.length > 0) {
        try {
          const firstEntry = JSON.parse(lines[0]);
          oldestEntry = new Date(firstEntry.timestamp);
        } catch {
          // Ignore parse errors
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return {
    totalEntries,
    fileSize,
    oldestEntry
  };
}

export default {
  initAuditLogService,
  logAuditEntry,
  queryAuditLogs,
  resetAuditLogService,
  getAuditLogStats,
  setConfigForTesting,
  resetConfig
};
