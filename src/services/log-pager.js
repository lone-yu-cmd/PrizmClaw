/**
 * Log Pager Service
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-2: Paginated Logs Query, US-3: Message Length Compliance
 *
 * Handles paginated log reading with offset and line limits.
 *
 * Design Decisions:
 * - D3: CLI argument pagination, no complex protocol
 * - D5: Real-time error extraction, no additional storage
 */

import fs from 'node:fs';
import readline from 'node:readline';
import { once } from 'node:events';

import { loadPipelineInfraConfig } from '../pipeline-infra/config-loader.js';
import { getStatePaths } from '../pipeline-infra/path-policy.js';

const MAX_LINES = 500;
const DEFAULT_LINES = 50;
const FILE_THRESHOLD_BYTES = 4000;
const LARGE_FILE_THRESHOLD = 1024 * 1024; // 1MB - use streaming for larger files

/**
 * Create a log pager instance.
 * @param {Object} options - Options
 * @param {Object} [options.stateManager] - State manager instance
 * @param {Object} [options.config] - Pipeline config
 * @returns {Object} Log pager interface
 */
export function createLogPager(options = {}) {
  const config = options.config || loadPipelineInfraConfig();

  /**
   * Get log file path for pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @returns {string} Log file path
   */
  function getLogPath(type) {
    const paths = getStatePaths(config.projectRoot, type);
    return paths.daemonLogFile;
  }

  /**
   * Count total lines in a file.
   * @param {string} filePath - File path
   * @returns {Promise<number>} Total line count
   */
  async function countLines(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n').filter(l => l.trim()).length;
    } catch {
      return 0;
    }
  }

  /**
   * Stream-read last N lines from a large file efficiently.
   * @param {string} filePath - File path
   * @param {number} lineCount - Number of lines to read
   * @param {number} offset - Lines to skip from end
   * @returns {Promise<{lines: string[], totalLines: number}>}
   */
  async function streamReadLastLines(filePath, lineCount, offset = 0) {
    return new Promise((resolve, reject) => {
      const lines = [];
      let totalLines = 0;

      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        totalLines++;
        // We'll collect all lines then slice at the end
      });

      rl.on('close', () => {
        // Re-open to get specific lines
        const startIdx = Math.max(0, totalLines - offset - lineCount);
        const endIdx = totalLines - offset;

        let currentLine = 0;
        const selectedLines = [];

        const stream2 = fs.createReadStream(filePath, { encoding: 'utf8' });
        const rl2 = readline.createInterface({
          input: stream2,
          crlfDelay: Infinity
        });

        rl2.on('line', (line) => {
          currentLine++;
          if (currentLine > startIdx && currentLine <= endIdx) {
            if (line.trim()) {
              selectedLines.push(line);
            }
          }
        });

        rl2.on('close', () => {
          resolve({ lines: selectedLines, totalLines });
        });

        rl2.on('error', (err) => {
          reject(err);
        });
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Read log page with pagination.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @param {Object} pageOptions - Pagination options
   * @param {number} [pageOptions.lines=50] - Number of lines to read
   * @param {number} [pageOptions.offset=0] - Number of lines to skip
   * @param {boolean} [pageOptions.reverse=true] - Read from end (newest first)
   * @returns {Promise<Object>} Log page result
   */
  async function readLogPage(type, pageOptions = {}) {
    const requestedLines = Math.min(pageOptions.lines || DEFAULT_LINES, MAX_LINES);
    const offset = pageOptions.offset || 0;
    const reverse = pageOptions.reverse !== false; // Default true

    const logPath = getLogPath(type);

    // Check if file exists
    if (!fs.existsSync(logPath)) {
      return {
        ok: true,
        logs: '',
        metadata: buildLogMetadata(logPath, 0, 0, 0, requestedLines, 0),
        message: '📭 暂无日志。Pipeline 尚未运行或日志文件不存在。'
      };
    }

    try {
      // Check file size for streaming optimization
      const stats = fs.statSync(logPath);
      const useStreaming = stats.size > LARGE_FILE_THRESHOLD;

      if (useStreaming) {
        // Use stream-based reading for large files (T-021)
        const result = await streamReadLastLines(logPath, requestedLines, offset);
        const { lines: selectedLines, totalLines } = result;

        const pageStart = Math.max(1, totalLines - offset - requestedLines + 1);
        const pageEnd = totalLines - offset;
        const logs = reverse ? selectedLines.reverse().join('\n') : selectedLines.join('\n');
        const actualLines = selectedLines.length;

        return {
          ok: true,
          logs,
          metadata: buildLogMetadata(logPath, totalLines, pageStart, pageEnd, requestedLines, actualLines)
        };
      }

      // Standard reading for smaller files
      const content = fs.readFileSync(logPath, 'utf8');
      const allLines = content.split('\n').filter(l => l.trim());
      const totalLines = allLines.length;

      if (totalLines === 0) {
        return {
          ok: true,
          logs: '',
          metadata: buildLogMetadata(logPath, 0, 0, 0, requestedLines, 0),
          message: '📭 日志文件为空。'
        };
      }

      // Apply pagination
      let selectedLines;
      let pageStart;
      let pageEnd;

      if (reverse) {
        // Read from end (newest first)
        const startIdx = Math.max(0, totalLines - offset - requestedLines);
        const endIdx = totalLines - offset;
        selectedLines = allLines.slice(startIdx, endIdx).reverse();
        pageStart = startIdx + 1;
        pageEnd = endIdx;
      } else {
        // Read from beginning
        selectedLines = allLines.slice(offset, offset + requestedLines);
        pageStart = offset + 1;
        pageEnd = Math.min(offset + requestedLines, totalLines);
      }

      const logs = selectedLines.join('\n');
      const actualLines = selectedLines.length;

      return {
        ok: true,
        logs,
        metadata: buildLogMetadata(logPath, totalLines, pageStart, pageEnd, requestedLines, actualLines)
      };
    } catch (error) {
      return {
        ok: true,
        logs: '',
        metadata: buildLogMetadata(logPath, 0, 0, 0, requestedLines, 0),
        message: `⚠️ 读取日志失败: ${error.message}`
      };
    }
  }

  /**
   * Extract error lines from log content.
   * @param {string} logs - Log content
   * @param {number} lineCount - Maximum lines to extract
   * @returns {Array<string>} Array of error lines
   */
  function extractErrorLines(logs, lineCount = 10) {
    if (!logs) return [];

    const lines = logs.split('\n');
    const errorLines = lines.filter(line =>
      line.includes('ERROR') ||
      line.includes('Error:') ||
      line.includes('Exception') ||
      line.includes('FAIL')
    );

    // Return last N error lines
    return errorLines.slice(-lineCount);
  }

  /**
   * Check if logs should be sent as file.
   * @param {string} logs - Log content
   * @param {number} [threshold] - Byte threshold (default 4000)
   * @returns {boolean} True if should send as file
   */
  function shouldSendAsFile(logs, threshold = FILE_THRESHOLD_BYTES) {
    if (!logs) return false;
    return Buffer.byteLength(logs, 'utf8') >= threshold;
  }

  /**
   * Build log metadata object.
   * @param {string} logPath - Log file path
   * @param {number} totalLines - Total lines in file
   * @param {number} pageStart - Start line of page
   * @param {number} pageEnd - End line of page
   * @param {number} requestedLines - Requested lines
   * @param {number} actualLines - Actual lines returned
   * @returns {Object} Metadata object
   */
  function buildLogMetadata(logPath, totalLines, pageStart, pageEnd, requestedLines, actualLines) {
    return {
      logPath,
      totalLines,
      pageStart,
      pageEnd,
      requestedLines,
      actualLines
    };
  }

  /**
   * Format logs for Telegram display.
   * @param {string} logs - Log content
   * @param {Object} metadata - Log metadata
   * @returns {string} Formatted message
   */
  function formatLogsForTelegram(logs, metadata = {}) {
    if (!logs || logs.trim() === '') {
      return '📭 暂无日志内容。';
    }

    const lines = [];

    // Add header with metadata
    lines.push('📋 **Pipeline 日志**');
    if (metadata.totalLines !== undefined) {
      lines.push(`总计: ${metadata.totalLines} 行`);
      if (metadata.pageStart && metadata.pageEnd) {
        lines.push(`显示: 第 ${metadata.pageStart}-${metadata.pageEnd} 行`);
      }
    }
    lines.push('');

    // Add segment numbering if provided
    if (metadata.totalSegments && metadata.segmentIndex !== undefined) {
      lines[0] = `📋 **Pipeline 日志** [${metadata.segmentIndex + 1}/${metadata.totalSegments}]`;
    }

    // Add log content
    lines.push('```');
    lines.push(logs);
    lines.push('```');

    return lines.join('\n');
  }

  return {
    readLogPage,
    formatLogsForTelegram,
    extractErrorLines,
    shouldSendAsFile,
    buildLogMetadata
  };
}

export default createLogPager;
