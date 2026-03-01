import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCommand, registerCommand } from '../../src/bot/commands/index.js';
import { clearRegistry } from '../../src/bot/commands/registry.js';
import { pipelineMeta } from '../../src/bot/commands/handlers/pipeline.js';
import { statusMeta } from '../../src/bot/commands/handlers/status.js';

test.beforeEach(() => {
  clearRegistry();
});

const createMockContext = (text) => ({
  from: { id: 12345 },
  message: { text },
  reply: async (msg) => msg,
  replyWithDocument: async () => {}
});

test('routeCommand returns false for non-command text', async () => {
  const ctx = createMockContext('hello world');
  const result = await routeCommand(ctx);
  assert.equal(result, false);
});

test('routeCommand returns true for command text', async () => {
  // Register a test command
  registerCommand(statusMeta, async () => {});

  const ctx = createMockContext('/status');
  const result = await routeCommand(ctx);
  assert.equal(result, true);
});

test('routeCommand handles unknown command', async () => {
  const ctx = createMockContext('/unknown');
  const result = await routeCommand(ctx);
  assert.equal(result, true); // Command was handled (with error message)
});

test('routeCommand handles command with subcommand', async () => {
  registerCommand(pipelineMeta, async () => {});

  const ctx = createMockContext('/pipeline status');
  const result = await routeCommand(ctx);
  assert.equal(result, true);
});

test('routeCommand applies alias mapping', async () => {
  registerCommand(pipelineMeta, async () => {});

  const ctx = createMockContext('/p status');
  const result = await routeCommand(ctx);
  assert.equal(result, true);
});

test('routeCommand validates parameters', async () => {
  registerCommand({
    name: 'test',
    params: [{ name: 'target', required: true, description: 'Target' }],
    requiresAuth: true,
    helpText: 'Test'
  }, async () => {});

  const ctx = createMockContext('/test');
  const result = await routeCommand(ctx);
  assert.equal(result, true); // Handled with validation error
});
