import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand, validateSubcommand } from '../../../src/bot/commands/validator.js';

test('validateCommand returns valid for simple command', () => {
  const parsed = { command: 'status', subcommand: undefined, args: [], options: {} };
  const meta = { name: 'status', params: [], requiresAuth: true };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateCommand returns valid when required param is provided', () => {
  const parsed = { command: 'bugfix', subcommand: undefined, args: [], options: { target: 'session-123' } };
  const meta = {
    name: 'bugfix',
    params: [{ name: 'target', required: true, description: 'Target ID' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
});

test('validateCommand returns error for missing required param', () => {
  const parsed = { command: 'bugfix', subcommand: undefined, args: [], options: {} };
  const meta = {
    name: 'bugfix',
    params: [{ name: 'target', required: true, description: 'Target ID' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.equal(result.errors[0].param, 'target');
  assert.ok(result.errors[0].message.includes('缺少参数'));
});

test('validateCommand validates enum values', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { type: 'invalid' } };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run pipeline' }],
    params: [{ name: 'type', type: 'enum', enum: ['feature', 'bugfix', 'planner'], description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].suggestion.includes('feature'));
});

test('validateCommand accepts valid enum value', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { type: 'bugfix' } };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run pipeline' }],
    params: [{ name: 'type', type: 'enum', enum: ['feature', 'bugfix', 'planner'], description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
});

test('validateCommand validates number type', () => {
  const parsed = { command: 'test', subcommand: undefined, args: [], options: { count: 'abc' } };
  const meta = {
    name: 'test',
    params: [{ name: 'count', type: 'number', description: 'Count' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].message.includes('数字'));
});

test('validateCommand accepts valid number', () => {
  const parsed = { command: 'test', subcommand: undefined, args: [], options: { count: '42' } };
  const meta = {
    name: 'test',
    params: [{ name: 'count', type: 'number', description: 'Count' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.count, 42);
});

test('validateCommand uses default value when param not provided', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: {} };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run pipeline' }],
    params: [{ name: 'type', type: 'string', default: 'feature', description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.type, 'feature');
});

test('validateCommand returns error for invalid subcommand', () => {
  const parsed = { command: 'pipeline', subcommand: 'invalid', args: [], options: {} };
  const meta = {
    name: 'pipeline',
    subcommands: [
      { name: 'run', description: 'Run' },
      { name: 'status', description: 'Status' }
    ],
    params: [],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, false);
  assert.ok(result.errors[0].message.includes('未知子命令'));
  assert.ok(result.errors[0].suggestion.includes('run'));
});

test('validateCommand includes normalized params on success', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { type: 'bugfix' } };
  const meta = {
    name: 'pipeline',
    subcommands: [{ name: 'run', description: 'Run' }],
    params: [{ name: 'type', type: 'string', default: 'feature', description: 'Type' }],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.ok(result.normalized);
  assert.equal(result.normalized.type, 'bugfix');
});

test('validateSubcommand returns valid for no subcommand', () => {
  const subcommands = [{ name: 'run', description: 'Run' }];
  const result = validateSubcommand(undefined, subcommands);
  assert.equal(result.valid, true);
});

test('validateSubcommand returns valid for known subcommand', () => {
  const subcommands = [{ name: 'run', description: 'Run' }, { name: 'status', description: 'Status' }];
  const result = validateSubcommand('run', subcommands);
  assert.equal(result.valid, true);
});

test('validateSubcommand returns error for unknown subcommand', () => {
  const subcommands = [{ name: 'run', description: 'Run' }, { name: 'status', description: 'Status' }];
  const result = validateSubcommand('invalid', subcommands);
  assert.equal(result.valid, false);
  assert.ok(result.error.message.includes('未知子命令'));
});

test('validateCommand handles subcommand-specific params', () => {
  const parsed = { command: 'pipeline', subcommand: 'run', args: [], options: { target: 'my-feature' } };
  const meta = {
    name: 'pipeline',
    subcommands: [
      { name: 'run', description: 'Run', params: [{ name: 'target', required: false, description: 'Target' }] }
    ],
    params: [],
    requiresAuth: true
  };

  const result = validateCommand(parsed, meta);
  assert.equal(result.valid, true);
});
