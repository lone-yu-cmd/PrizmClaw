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
  DAEMON_START_FAILED: 'DAEMON_START_FAILED',

  // F-005: Pipeline Status Aggregation and Log Streaming
  STATE_FILE_MISSING: 'STATE_FILE_MISSING',
  STATE_FILE_CORRUPTED: 'STATE_FILE_CORRUPTED',
  LOG_FILE_MISSING: 'LOG_FILE_MISSING',
  LOG_READ_ERROR: 'LOG_READ_ERROR',
  SEND_FAILED: 'SEND_FAILED',
  FILE_SEND_FAILED: 'FILE_SEND_FAILED',
  HEARTBEAT_DISABLED: 'HEARTBEAT_DISABLED',
  INVALID_PIPELINE_TYPE: 'INVALID_PIPELINE_TYPE'
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
