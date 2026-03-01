import { spawn } from 'node:child_process';
import { config } from '../config.js';

export async function runCodeBuddy(prompt, options = {}) {
  const { onStdoutChunk } = options;
  const args = ['-p', prompt];

  if (config.codebuddyPermissionFlag) {
    args.push(config.codebuddyPermissionFlag);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(config.codebuddyBin, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timeout =
      config.requestTimeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`CodeBuddy 执行超时（>${config.requestTimeoutMs}ms）`));
          }, config.requestTimeoutMs)
        : null;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (typeof onStdoutChunk === 'function') {
        onStdoutChunk(text);
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`无法启动 CodeBuddy: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve(stdout.trim() || 'CodeBuddy 未返回文本结果。');
        return;
      }

      reject(
        new Error(`CodeBuddy 退出码 ${code}。${stderr ? `\n错误信息:\n${stderr.trim()}` : ''}`)
      );
    });
  });
}
