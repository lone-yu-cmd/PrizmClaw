import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INFRA_ERROR_CODES,
  createInfraError,
  isInfraErrorCode
} from '../../src/pipeline-infra/error-codes.js';

test('INFRA_ERROR_CODES should include required categories', () => {
  // Existing codes
  assert.equal(INFRA_ERROR_CODES.CONFIG_MISSING, 'CONFIG_MISSING');
  assert.equal(INFRA_ERROR_CODES.CONFIG_INVALID, 'CONFIG_INVALID');
  assert.equal(INFRA_ERROR_CODES.PATH_INVALID, 'PATH_INVALID');
  assert.equal(INFRA_ERROR_CODES.SCRIPT_NOT_FOUND, 'SCRIPT_NOT_FOUND');
  assert.equal(INFRA_ERROR_CODES.EXEC_TIMEOUT, 'EXEC_TIMEOUT');
  assert.equal(INFRA_ERROR_CODES.EXEC_FAILED, 'EXEC_FAILED');

  // F-004: Pipeline Process Controller codes
  assert.equal(INFRA_ERROR_CODES.LOCK_ACQUISITION_FAILED, 'LOCK_ACQUISITION_FAILED');
  assert.equal(INFRA_ERROR_CODES.ALREADY_STOPPED, 'ALREADY_STOPPED');
  assert.equal(INFRA_ERROR_CODES.PIPELINE_NOT_RUNNING, 'PIPELINE_NOT_RUNNING');
  assert.equal(INFRA_ERROR_CODES.INVALID_TARGET, 'INVALID_TARGET');
  assert.equal(INFRA_ERROR_CODES.TARGET_NOT_RETRYABLE, 'TARGET_NOT_RETRYABLE');
  assert.equal(INFRA_ERROR_CODES.DAEMON_START_FAILED, 'DAEMON_START_FAILED');
});

test('isInfraErrorCode should validate known error code values', () => {
  assert.equal(isInfraErrorCode('CONFIG_MISSING'), true);
  assert.equal(isInfraErrorCode('NOT_REAL'), false);

  // F-004 new codes
  assert.equal(isInfraErrorCode('LOCK_ACQUISITION_FAILED'), true);
  assert.equal(isInfraErrorCode('ALREADY_STOPPED'), true);
  assert.equal(isInfraErrorCode('PIPELINE_NOT_RUNNING'), true);
  assert.equal(isInfraErrorCode('INVALID_TARGET'), true);
  assert.equal(isInfraErrorCode('TARGET_NOT_RETRYABLE'), true);
  assert.equal(isInfraErrorCode('DAEMON_START_FAILED'), true);
});

test('createInfraError should produce serializable error objects', () => {
  const err = createInfraError('CONFIG_MISSING', 'Missing env var', {
    hint: 'Set MY_ENV in .env',
    context: { field: 'MY_ENV' }
  });

  assert.deepEqual(err, {
    code: 'CONFIG_MISSING',
    message: 'Missing env var',
    hint: 'Set MY_ENV in .env',
    context: { field: 'MY_ENV' }
  });

  assert.doesNotThrow(() => JSON.stringify(err));
});

test('createInfraError should reject unknown error codes', () => {
  assert.throws(() => {
    createInfraError('UNKNOWN', 'oops');
  }, /Unknown infra error code/i);
});

// F-004: Test new error codes with createInfraError
test('createInfraError should accept F-004 error codes', () => {
  const lockError = createInfraError('LOCK_ACQUISITION_FAILED', 'Pipeline already running', {
    hint: 'Stop the current pipeline first',
    context: { currentPid: 12345 }
  });

  assert.equal(lockError.code, 'LOCK_ACQUISITION_FAILED');
  assert.equal(lockError.message, 'Pipeline already running');
  assert.equal(lockError.hint, 'Stop the current pipeline first');
  assert.deepEqual(lockError.context, { currentPid: 12345 });
  assert.doesNotThrow(() => JSON.stringify(lockError));
});

test('createInfraError should create ALREADY_STOPPED error', () => {
  const err = createInfraError('ALREADY_STOPPED', 'Pipeline is not running');
  assert.equal(err.code, 'ALREADY_STOPPED');
  assert.equal(err.message, 'Pipeline is not running');
});

test('createInfraError should create INVALID_TARGET error with hint', () => {
  const err = createInfraError('INVALID_TARGET', 'Target not found', {
    hint: 'Check the target ID in the feature list',
    context: { targetId: 'F-999' }
  });
  assert.equal(err.code, 'INVALID_TARGET');
  assert.equal(err.hint, 'Check the target ID in the feature list');
  assert.deepEqual(err.context, { targetId: 'F-999' });
});

// F-001 T-010: EXIT_CODES tests
import { EXIT_CODES } from '../../src/pipeline-infra/error-codes.js';

test('EXIT_CODES should define standard process exit codes', () => {
  assert.equal(EXIT_CODES.SUCCESS, 0);
  assert.equal(EXIT_CODES.RUNTIME_ERROR, 1);
  assert.equal(EXIT_CODES.USAGE_ERROR, 2);
  assert.equal(EXIT_CODES.TIMEOUT, 124);
});

test('EXIT_CODES should be frozen (immutable)', () => {
  assert.ok(Object.isFrozen(EXIT_CODES));
});

test('EXIT_CODES should have exactly 4 keys', () => {
  const keys = Object.keys(EXIT_CODES);
  assert.equal(keys.length, 4);
  assert.deepEqual(keys.sort(), ['RUNTIME_ERROR', 'SUCCESS', 'TIMEOUT', 'USAGE_ERROR']);
});

test('EXIT_CODES values should all be numbers', () => {
  for (const [key, value] of Object.entries(EXIT_CODES)) {
    assert.equal(typeof value, 'number', `EXIT_CODES.${key} should be a number`);
  }
});
