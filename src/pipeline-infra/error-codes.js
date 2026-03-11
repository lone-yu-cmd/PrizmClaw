export const INFRA_ERROR_CODES = Object.freeze({
  // Existing codes
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_INVALID: 'CONFIG_INVALID',
  PATH_INVALID: 'PATH_INVALID',
  SCRIPT_NOT_FOUND: 'SCRIPT_NOT_FOUND',
  EXEC_TIMEOUT: 'EXEC_TIMEOUT',
  EXEC_FAILED: 'EXEC_FAILED',

  // F-004: Pipeline Process Controller
  LOCK_ACQUISITION_FAILED: 'LOCK_ACQUISITION_FAILED',
  ALREADY_STOPPED: 'ALREADY_STOPPED',
  PIPELINE_NOT_RUNNING: 'PIPELINE_NOT_RUNNING',
  INVALID_TARGET: 'INVALID_TARGET',
  TARGET_NOT_RETRYABLE: 'TARGET_NOT_RETRYABLE',
  DAEMON_START_FAILED: 'DAEMON_START_FAILED'
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
