import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerCommand,
  getCommand,
  getAllCommands,
  isAlias,
  getHelpText,
  clearRegistry,
  getAliasMap
} from '../../../src/bot/commands/registry.js';

test.beforeEach(() => {
  clearRegistry();
});

test('registerCommand stores command with metadata', () => {
  const meta = {
    name: 'test',
    description: 'Test command',
    requiresAuth: true,
    helpText: 'Test help'
  };
  const handler = async () => {};

  registerCommand(meta, handler);

  const entry = getCommand('test');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'test');
  assert.equal(entry.handler, handler);
});

test('registerCommand throws on duplicate command', () => {
  const meta = { name: 'test', description: 'Test', requiresAuth: true, helpText: 'Test' };
  registerCommand(meta, async () => {});

  assert.throws(() => {
    registerCommand(meta, async () => {});
  }, /already registered/);
});

test('registerCommand stores aliases', () => {
  const meta = {
    name: 'pipeline',
    aliases: ['p'],
    description: 'Pipeline command',
    requiresAuth: true,
    helpText: 'Pipeline help'
  };

  registerCommand(meta, async () => {});

  const entry = getCommand('p');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'pipeline');
});

test('registerCommand throws on duplicate alias', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});

  assert.throws(() => {
    registerCommand({ name: 'planner', aliases: ['p'], description: 'Planner', requiresAuth: true, helpText: '' }, async () => {});
  }, /already registered/);
});

test('getCommand returns null for unknown command', () => {
  const entry = getCommand('unknown');
  assert.equal(entry, null);
});

test('getCommand is case-insensitive', () => {
  registerCommand({ name: 'Test', description: 'Test', requiresAuth: true, helpText: '' }, async () => {});

  const entry = getCommand('TEST');
  assert.ok(entry);
  assert.equal(entry.meta.name, 'test');
});

test('isAlias returns true for registered alias', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});

  assert.equal(isAlias('p'), true);
  assert.equal(isAlias('P'), true);
  assert.equal(isAlias('pipeline'), false);
});

test('getAllCommands returns all registered commands', () => {
  registerCommand({ name: 'pipeline', description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});
  registerCommand({ name: 'status', description: 'Status', requiresAuth: true, helpText: '' }, async () => {});

  const commands = getAllCommands();
  assert.equal(commands.length, 2);
});

test('getHelpText generates general help', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: '管理管道', requiresAuth: true, helpText: '' }, async () => {});
  registerCommand({ name: 'status', aliases: ['s'], description: '查看状态', requiresAuth: true, helpText: '' }, async () => {});

  const help = getHelpText();
  assert.ok(help.includes('可用命令'));
  assert.ok(help.includes('/pipeline'));
  assert.ok(help.includes('/status'));
});

test('getHelpText generates specific command help', () => {
  registerCommand({
    name: 'pipeline',
    aliases: ['p'],
    description: '管理管道',
    usage: '/pipeline <action>',
    subcommands: [
      { name: 'run', description: '启动' },
      { name: 'status', description: '状态' }
    ],
    requiresAuth: true,
    helpText: ''
  }, async () => {});

  const help = getHelpText('pipeline');
  assert.ok(help.includes('/pipeline'));
  assert.ok(help.includes('管理管道'));
  assert.ok(help.includes('run'));
  assert.ok(help.includes('status'));
});

test('getHelpText returns error for unknown command', () => {
  const help = getHelpText('unknown');
  assert.ok(help.includes('未知命令'));
});

test('getAliasMap returns correct mapping', () => {
  registerCommand({ name: 'pipeline', aliases: ['p'], description: 'Pipeline', requiresAuth: true, helpText: '' }, async () => {});
  registerCommand({ name: 'status', aliases: ['s'], description: 'Status', requiresAuth: true, helpText: '' }, async () => {});

  const aliasMap = getAliasMap();
  assert.equal(aliasMap.p, 'pipeline');
  assert.equal(aliasMap.s, 'status');
});

test('clearRegistry removes all commands', () => {
  registerCommand({ name: 'test', description: 'Test', requiresAuth: true, helpText: '' }, async () => {});
  clearRegistry();

  const entry = getCommand('test');
  assert.equal(entry, null);
});

test('registerCommand with no name throws', () => {
  assert.throws(() => {
    registerCommand({ description: 'Test' }, async () => {});
  }, /must have a name/);
});
