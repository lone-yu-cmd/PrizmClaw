import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { assertAllowedCommand, assertSystemExecEnabled } from '../security/system-guard.js';

export async function executeSystemCommand(command) {
  assertSystemExecEnabled();
  const safeCommand = assertAllowedCommand(command);

  return new Promise((resolve, reject) => {
    const child = spawn(safeCommand, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`系统命令执行超时（>${config.systemExecTimeoutMs}ms）`));
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
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1
      });
    });
  });
}
