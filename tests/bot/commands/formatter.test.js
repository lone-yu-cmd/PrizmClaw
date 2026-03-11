import test from 'node:test';
import assert from 'node:assert/strict';
import { formatError, formatValidationErrors, formatErrorResponse, ErrorCodes } from '../../../src/bot/commands/formatter.js';

test('formatError UNKNOWN_COMMAND', () => {
  const error = formatError(ErrorCodes.UNKNOWN_COMMAND, { command: 'xyz' });
  assert.equal(error.code, ErrorCodes.UNKNOWN_COMMAND);
  assert.ok(error.message.includes('未知命令'));
  assert.ok(error.message.includes('xyz'));
  assert.ok(error.suggestion.includes('/help'));
});

test('formatError UNKNOWN_SUBCOMMAND', () => {
  const error = formatError(ErrorCodes.UNKNOWN_SUBCOMMAND, {
    subcommand: 'xyz',
    available: ['run', 'status']
  });
  assert.equal(error.code, ErrorCodes.UNKNOWN_SUBCOMMAND);
  assert.ok(error.message.includes('未知子命令'));
  assert.ok(error.suggestion.includes('run'));
});

test('formatError MISSING_PARAM', () => {
  const error = formatError(ErrorCodes.MISSING_PARAM, { param: 'target' });
  assert.equal(error.code, ErrorCodes.MISSING_PARAM);
  assert.ok(error.message.includes('缺少参数'));
  assert.ok(error.message.includes('target'));
});

test('formatError INVALID_PARAM', () => {
  const error = formatError(ErrorCodes.INVALID_PARAM, {
    param: 'type',
    reason: '无效值',
    suggestion: '可选: feature, bugfix'
  });
  assert.equal(error.code, ErrorCodes.INVALID_PARAM);
  assert.ok(error.message.includes('无效'));
  assert.ok(error.suggestion.includes('feature'));
});

test('formatError UNAUTHORIZED', () => {
  const error = formatError(ErrorCodes.UNAUTHORIZED, {});
  assert.equal(error.code, ErrorCodes.UNAUTHORIZED);
  assert.ok(error.message.includes('未被授权'));
});

test('formatError INTERNAL_ERROR', () => {
  const error = formatError(ErrorCodes.INTERNAL_ERROR, { reason: 'Connection failed' });
  assert.equal(error.code, ErrorCodes.INTERNAL_ERROR);
  assert.ok(error.message.includes('内部错误'));
});

test('formatValidationErrors formats multiple errors', () => {
  const errors = [
    { param: 'target', message: '缺少参数 target', suggestion: '请提供 target' },
    { param: 'type', message: '无效类型', suggestion: '可选: feature, bugfix' }
  ];

  const result = formatValidationErrors(errors, '/pipeline run <target>');
  assert.ok(result.includes('缺少参数'));
  assert.ok(result.includes('建议'));
  assert.ok(result.includes('用法'));
});

test('formatValidationErrors returns empty for no errors', () => {
  const result = formatValidationErrors([], '/usage');
  assert.equal(result, '');
});

test('formatErrorResponse formats complete error', () => {
  const error = {
    code: ErrorCodes.MISSING_PARAM,
    message: '缺少参数 target',
    suggestion: '请提供 target 参数',
    usage: '/bugfix <target>'
  };

  const result = formatErrorResponse(error);
  assert.ok(result.includes('❌'));
  assert.ok(result.includes('💡'));
  assert.ok(result.includes('用法'));
});

test('formatErrorResponse handles minimal error', () => {
  const error = {
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Unknown error'
  };

  const result = formatErrorResponse(error);
  assert.ok(result.includes('❌'));
  assert.ok(!result.includes('💡'));
});
