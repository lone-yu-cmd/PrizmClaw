import { config } from '../config.js';

export function isAllowedUser(userId) {
  if (config.allowedUserIds.size === 0) {
    return true;
  }
  return config.allowedUserIds.has(String(userId));
}

export function sanitizeInput(input) {
  const text = (input ?? '').trim();

  if (!text) {
    throw new Error('消息为空，请输入有效内容。');
  }

  if (text.length > config.maxPromptChars) {
    throw new Error(`消息过长，最多 ${config.maxPromptChars} 个字符。`);
  }

  return text;
}
