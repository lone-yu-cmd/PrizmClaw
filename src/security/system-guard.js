import { config } from '../config.js';

export function assertSystemExecEnabled() {
  if (!config.enableSystemExec) {
    throw new Error('系统命令执行未启用。请在 .env 中设置 ENABLE_SYSTEM_EXEC=true。');
  }
}

export function assertAllowedCommand(command) {
  const normalized = String(command ?? '').trim();

  if (!normalized) {
    throw new Error('command 不能为空。');
  }

  if (normalized.length > 2000) {
    throw new Error('command 过长。');
  }

  if (config.allowedCommandPrefixes.length === 0) {
    throw new Error('未配置 ALLOWED_COMMAND_PREFIXES，已拒绝执行。');
  }

  const allowed = config.allowedCommandPrefixes.some((prefix) => normalized.startsWith(prefix));
  if (!allowed) {
    throw new Error(
      `命令不在白名单前缀内。允许前缀: ${config.allowedCommandPrefixes.join(', ')}`
    );
  }

  return normalized;
}
