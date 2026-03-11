/**
 * Error Formatter
 * Formats error messages for user-friendly display.
 */

/**
 * Error codes for command errors.
 */
export const ErrorCodes = {
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  UNKNOWN_SUBCOMMAND: 'UNKNOWN_SUBCOMMAND',
  MISSING_PARAM: 'MISSING_PARAM',
  INVALID_PARAM: 'INVALID_PARAM',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * @typedef {Object} ErrorResponse
 * @property {string} code - Error code
 * @property {string} message - User-friendly error message
 * @property {string} [suggestion] - Correction suggestion
 * @property {string} [usage] - Correct usage example
 */

/**
 * Format an error for display to the user.
 * @param {string} code - Error code
 * @param {Object} context - Error context
 * @param {string} [context.command] - Command name
 * @param {string} [context.subcommand] - Subcommand name
 * @param {string} [context.param] - Parameter name
 * @param {string} [context.value] - Invalid value
 * @param {string} [context.reason] - Error reason
 * @param {string} [context.suggestion] - Custom suggestion
 * @param {string} [context.usage] - Correct usage
 * @param {string[]} [context.available] - Available options
 * @returns {ErrorResponse} Formatted error
 */
export function formatError(code, context = {}) {
  switch (code) {
    case ErrorCodes.UNKNOWN_COMMAND:
      return {
        code,
        message: `未知命令 '${context.command || ''}'。`,
        suggestion: '输入 /help 查看可用命令。'
      };

    case ErrorCodes.UNKNOWN_SUBCOMMAND:
      return {
        code,
        message: `未知子命令 '${context.subcommand || ''}'。`,
        suggestion: context.available ? `可用: ${context.available.join(', ')}` : undefined,
        usage: context.usage
      };

    case ErrorCodes.MISSING_PARAM:
      return {
        code,
        message: `缺少参数 '${context.param || ''}'。`,
        suggestion: context.suggestion || `请提供 ${context.param} 参数`,
        usage: context.usage
      };

    case ErrorCodes.INVALID_PARAM:
      return {
        code,
        message: `参数 '${context.param || ''}' 无效: ${context.reason || ''}`,
        suggestion: context.suggestion,
        usage: context.usage
      };

    case ErrorCodes.UNAUTHORIZED:
      return {
        code,
        message: '当前账号未被授权使用该命令。',
        suggestion: '请联系管理员获取授权。'
      };

    case ErrorCodes.INTERNAL_ERROR:
      return {
        code,
        message: '内部错误，请稍后重试。',
        suggestion: context.reason ? `错误: ${context.reason}` : undefined
      };

    default:
      return {
        code: ErrorCodes.INTERNAL_ERROR,
        message: '未知错误。'
      };
  }
}

/**
 * Format validation errors into a single message.
 * @param {import('./validator.js').ValidationError[]} errors - Validation errors
 * @param {string} [usage] - Usage hint
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors, usage) {
  if (!errors || errors.length === 0) {
    return '';
  }

  const lines = [];

  for (const error of errors) {
    lines.push(`❌ ${error.message}`);
    if (error.suggestion) {
      lines.push(`   建议: ${error.suggestion}`);
    }
  }

  if (usage) {
    lines.push(`\n用法: ${usage}`);
  }

  return lines.join('\n');
}

/**
 * Format an error response into a display string.
 * @param {ErrorResponse} error - Error response
 * @returns {string} Formatted string
 */
export function formatErrorResponse(error) {
  const lines = [`❌ ${error.message}`];

  if (error.suggestion) {
    lines.push(`💡 ${error.suggestion}`);
  }

  if (error.usage) {
    lines.push(`用法: ${error.usage}`);
  }

  return lines.join('\n');
}
