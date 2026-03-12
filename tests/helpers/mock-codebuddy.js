/**
 * Mock CodeBuddy CLI Helper
 * F-011: AI CLI Proxy Testing
 *
 * Simulates various CodeBuddy CLI scenarios for testing:
 * - Success with output
 * - Timeout simulation
 * - Error with exit code
 * - Slow/chunked output
 * - Interruptible processes
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the mock script
 */
const MOCK_SCRIPT_PATH = join(__dirname, 'mock-codebuddy-script.js');

/**
 * @typedef {Object} MockOptions
 * @property {number} [delay] - Delay before output starts (ms)
 * @property {number} [exitCode] - Exit code (default 0)
 * @property {string} [stderr] - Stderr content
 * @property {number} [chunkInterval] - Interval between chunks (ms)
 * @property {boolean} [interruptible] - Whether process can be interrupted
 * @property {number} [timeout] - Simulate timeout by running forever
 */

/**
 * Create a mock CodeBuddy process for testing.
 * @param {string} output - Output to produce
 * @param {MockOptions} [options] - Mock options
 * @returns {import('node:child_process').ChildProcess}
 */
export function createMockCodeBuddyProcess(output, options = {}) {
  const args = [
    MOCK_SCRIPT_PATH,
    '--output', output,
    '--delay', String(options.delay || 0),
    '--exit-code', String(options.exitCode || 0),
    '--stderr', options.stderr || '',
    '--chunk-interval', String(options.chunkInterval || 0),
    '--timeout', String(options.timeout || 0)
  ];

  return spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

/**
 * Create a mock that simulates success.
 * @param {string} output - Output to return
 * @param {Object} [options] - Additional options
 * @returns {import('node:child_process').ChildProcess}
 */
export function simulateSuccess(output, options = {}) {
  return createMockCodeBuddyProcess(output, {
    exitCode: 0,
    ...options
  });
}

/**
 * Create a mock that simulates timeout (runs forever).
 * @param {Object} [options] - Additional options
 * @returns {import('node:child_process').ChildProcess}
 */
export function simulateTimeout(options = {}) {
  return createMockCodeBuddyProcess('', {
    timeout: 1, // Will run until killed
    ...options
  });
}

/**
 * Create a mock that simulates error.
 * @param {number} exitCode - Exit code (non-zero)
 * @param {string} stderr - Stderr content
 * @param {Object} [options] - Additional options
 * @returns {import('node:child_process').ChildProcess}
 */
export function simulateError(exitCode, stderr, options = {}) {
  return createMockCodeBuddyProcess('', {
    exitCode,
    stderr,
    ...options
  });
}

/**
 * Create a mock that produces slow chunked output.
 * @param {string[]} chunks - Array of output chunks
 * @param {number} intervalMs - Interval between chunks (ms)
 * @param {Object} [options] - Additional options
 * @returns {import('node:child_process').ChildProcess}
 */
export function simulateSlowOutput(chunks, intervalMs, options = {}) {
  return createMockCodeBuddyProcess(chunks.join('\n'), {
    chunkInterval: intervalMs,
    ...options
  });
}

/**
 * Create a mock that can be interrupted.
 * @param {string} initialOutput - Initial output before interrupt point
 * @param {Object} [options] - Additional options
 * @returns {import('node:child_process').ChildProcess}
 */
export function simulateInterruptible(initialOutput, options = {}) {
  return createMockCodeBuddyProcess(initialOutput, {
    timeout: 1, // Will run until killed
    interruptible: true,
    ...options
  });
}

/**
 * Run mock CodeBuddy and return result.
 * @param {string} output - Output to produce
 * @param {MockOptions} [options] - Mock options
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export function runMockCodeBuddy(output, options = {}) {
  return new Promise((resolve) => {
    const child = createMockCodeBuddyProcess(output, options);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0
      });
    });

    child.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1
      });
    });
  });
}

export default {
  createMockCodeBuddyProcess,
  simulateSuccess,
  simulateTimeout,
  simulateError,
  simulateSlowOutput,
  simulateInterruptible,
  runMockCodeBuddy
};
