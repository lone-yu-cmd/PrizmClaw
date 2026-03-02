import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

function writeEcho(tag, text) {
  const normalized = String(text ?? '');
  if (!normalized) {
    return;
  }

  const lines = normalized.split(/\r?\n/);
  for (const line of lines) {
    if (!line) {
      continue;
    }
    process.stdout.write(`[CodeBuddy:${tag}] ${line}\n`);
  }
}

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

    const startedAt = Date.now();
    logger.info({ pid: child.pid, bin: config.codebuddyBin, args }, 'CodeBuddy process started');

    let stdout = '';
    let stderr = '';

    const heartbeat =
      config.codebuddyHeartbeatMs > 0
        ? setInterval(() => {
            const elapsedMs = Date.now() - startedAt;
            logger.info(
              {
                pid: child.pid,
                elapsedSec: Math.floor(elapsedMs / 1000),
                stdoutBytes: Buffer.byteLength(stdout),
                stderrBytes: Buffer.byteLength(stderr)
              },
              'CodeBuddy still running'
            );
          }, config.codebuddyHeartbeatMs)
        : null;

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

      if (config.codebuddyEchoStdio) {
        writeEcho('stdout', text);
      }

      if (typeof onStdoutChunk === 'function') {
        onStdoutChunk(text);
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;

      if (config.codebuddyEchoStdio) {
        writeEcho('stderr', text);
      }
    });

    child.on('error', (err) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      reject(new Error(`无法启动 CodeBuddy: ${err.message}`));
    });

    child.on('close', (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      const elapsedMs = Date.now() - startedAt;
      logger.info(
        { pid: child.pid, code, elapsedSec: Math.floor(elapsedMs / 1000) },
        'CodeBuddy process closed'
      );

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
