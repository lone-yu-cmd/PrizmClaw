import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../../../src/bot/commands/parser.js';

test('parseCommand returns null for non-command text', () => {
  assert.equal(parseCommand('hello world'), null);
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand(null), null);
  assert.equal(parseCommand(undefined), null);
});

test('parseCommand parses basic command', () => {
  const result = parseCommand('/start');
  assert.deepEqual(result, {
    command: 'start',
    subcommand: undefined,
    args: [],
    options: {},
    raw: '/start'
  });
});

test('parseCommand parses command with subcommand', () => {
  const result = parseCommand('/pipeline run');
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
});

test('parseCommand parses command with positional args', () => {
  const result = parseCommand('/bugfix session-123');
  assert.equal(result.command, 'bugfix');
  assert.deepEqual(result.args, []);
  // First token after command is treated as subcommand if it doesn't start with --
  assert.equal(result.subcommand, 'session-123');
});

test('parseCommand parses --key=value options', () => {
  const result = parseCommand('/pipeline run --type=bugfix');
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
  assert.deepEqual(result.options, { type: 'bugfix' });
});

test('parseCommand parses multiple options', () => {
  const result = parseCommand('/pipeline run --type=feature --verbose');
  assert.deepEqual(result.options, { type: 'feature', verbose: 'true' });
});

test('parseCommand parses key=value without --', () => {
  const result = parseCommand('/pipeline run type=bugfix');
  assert.deepEqual(result.options, { type: 'bugfix' });
});

test('parseCommand applies alias mapping', () => {
  const aliasMap = { p: 'pipeline', b: 'bugfix' };
  const result = parseCommand('/p run', aliasMap);
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
});

test('parseCommand handles @bot suffix', () => {
  const result = parseCommand('/start@mybot');
  assert.equal(result.command, 'start');
});

test('parseCommand normalizes command to lowercase', () => {
  const result = parseCommand('/PIPELINE RUN');
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
});

test('parseCommand collects positional args after options', () => {
  const result = parseCommand('/pipeline run my-feature --type=bugfix');
  assert.equal(result.subcommand, 'run');
  assert.deepEqual(result.options, { type: 'bugfix' });
  // Args should be empty since first token after subcommand is captured
});

test('parseCommand handles complex command', () => {
  const aliasMap = { p: 'pipeline' };
  const result = parseCommand('/p run my-feature --type=bugfix --verbose', aliasMap);
  assert.equal(result.command, 'pipeline');
  assert.equal(result.subcommand, 'run');
  assert.deepEqual(result.options, { type: 'bugfix', verbose: 'true' });
});

test('parseCommand preserves raw text', () => {
  const text = '/pipeline run --type=bugfix';
  const result = parseCommand(text);
  assert.equal(result.raw, text);
});

test('parseCommand handles empty options gracefully', () => {
  const result = parseCommand('/status');
  assert.deepEqual(result.options, {});
  assert.deepEqual(result.args, []);
});

test('parseCommand parses /logs with target', () => {
  const result = parseCommand('/logs session-123');
  assert.equal(result.command, 'logs');
  assert.equal(result.subcommand, 'session-123');
});

test('parseCommand parses /stop with target', () => {
  const result = parseCommand('/stop my-feature');
  assert.equal(result.command, 'stop');
  assert.equal(result.subcommand, 'my-feature');
});

test('parseCommand handles alias /s for status', () => {
  const aliasMap = { s: 'status' };
  const result = parseCommand('/s', aliasMap);
  assert.equal(result.command, 'status');
});

test('parseCommand handles alias /l for logs', () => {
  const aliasMap = { l: 'logs' };
  const result = parseCommand('/l session-123', aliasMap);
  assert.equal(result.command, 'logs');
});
