export const INFRA_ERROR_CODES = Object.freeze({
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_INVALID: 'CONFIG_INVALID',
  PATH_INVALID: 'PATH_INVALID',
  SCRIPT_NOT_FOUND: 'SCRIPT_NOT_FOUND',
  EXEC_TIMEOUT: 'EXEC_TIMEOUT',
  EXEC_FAILED: 'EXEC_FAILED'
});

const ERROR_CODE_SET = new Set(Object.values(INFRA_ERROR_CODES));

export function isInfraErrorCode(code) {
  return ERROR_CODE_SET.has(code);
}

export function createInfraError(code, message, options = {}) {
  if (!isInfraErrorCode(code)) {
    throw new Error(`Unknown infra error code: ${code}`);
  }

  return {
    code,
    message: String(message ?? ''),
    ...(options.hint ? { hint: String(options.hint) } : {}),
    ...(options.context ? { context: options.context } : {})
  };
}
