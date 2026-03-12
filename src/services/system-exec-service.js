import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { assertAllowedCommand, assertSystemExecEnabled } from '../security/system-guard.js';

/**
 * Grace period after SIGTERM before SIGKILL (in ms)
 */
const GRACE_PERIOD_MS = 5000;

/**
 * Execute a system command with optional working directory.
 * @param {string} command - Command to execute
 * @param {Object} [options] - Execution options
 * @param {string} [options.cwd] - Working directory for the command
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, timedOut: boolean }>}
 */
export async function executeSystemCommand(command, options = {}) {
  assertSystemExecEnabled();
  const safeCommand = assertAllowedCommand(command);

  const cwd = options.cwd || process.cwd();

  return new Promise((resolve, reject) => {
    const child = spawn(safeCommand, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let sigtermSent = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      sigtermSent = true;
      child.kill('SIGTERM');

      // Schedule SIGKILL after grace period
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, GRACE_PERIOD_MS);
    }, config.systemExecTimeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`系统命令执行失败: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        // Resolve with timeout status instead of rejecting
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          timedOut: true
        });
      } else {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          timedOut: false
        });
      }
    });
  });
}
