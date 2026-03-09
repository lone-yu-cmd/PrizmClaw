import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INFRA_ERROR_CODES,
  createInfraError,
  isInfraErrorCode
} from '../../src/pipeline-infra/error-codes.js';

test('INFRA_ERROR_CODES should include required categories', () => {
  assert.equal(INFRA_ERROR_CODES.CONFIG_MISSING, 'CONFIG_MISSING');
  assert.equal(INFRA_ERROR_CODES.CONFIG_INVALID, 'CONFIG_INVALID');
  assert.equal(INFRA_ERROR_CODES.PATH_INVALID, 'PATH_INVALID');
  assert.equal(INFRA_ERROR_CODES.SCRIPT_NOT_FOUND, 'SCRIPT_NOT_FOUND');
  assert.equal(INFRA_ERROR_CODES.EXEC_TIMEOUT, 'EXEC_TIMEOUT');
  assert.equal(INFRA_ERROR_CODES.EXEC_FAILED, 'EXEC_FAILED');
});

test('isInfraErrorCode should validate known error code values', () => {
  assert.equal(isInfraErrorCode('CONFIG_MISSING'), true);
  assert.equal(isInfraErrorCode('NOT_REAL'), false);
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
