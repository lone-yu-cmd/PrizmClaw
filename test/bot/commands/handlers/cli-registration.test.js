import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { cliMeta, handleCli, cliCommandHandler } from '../../../../src/bot/commands/handlers/cli.js';

describe('CLI Command Registration', () => {
  describe('CLI command metadata', () => {
    it('should have correct command name', () => {
      assert.strictEqual(cliMeta.name, 'cli');
    });

    it('should have correct aliases', () => {
      assert.deepStrictEqual(cliMeta.aliases, ['backend', 'ai-backend']);
    });

    it('should have correct description', () => {
      assert.strictEqual(cliMeta.description, 'AI CLI后端切换和管理');
    });

    it('should have correct usage', () => {
      assert.strictEqual(cliMeta.usage, '/cli [list|reset|<backend>]');
    });

    it('should have correct examples', () => {
      assert.deepStrictEqual(cliMeta.examples, [
        '/cli',
        '/cli list',
        '/cli claude',
        '/cli reset'
      ]);
    });

    it('should require authentication', () => {
      assert.strictEqual(cliMeta.requiresAuth, true);
    });

    it('should have minimum role requirement', () => {
      assert.strictEqual(cliMeta.minRole, 'operator');
    });
  });

  describe('CLI command handler', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof handleCli, 'function');
    });

    it('should handle handler context parameter', () => {
      assert.strictEqual(handleCli.length, 1);
    });

    it('should delegate to CLI command handler instance', async () => {
      // Mock the CLI command handler
      const mockResult = '✅ CLI command executed successfully';
      const mockHandle = mock.method(cliCommandHandler, 'handle', () => mockResult);

      // Mock handler context
      const mockCtx = {
        from: { id: 12345 }
      };
      const mockReply = mock.fn(() => Promise.resolve());
      const handlerCtx = {
        ctx: mockCtx,
        reply: mockReply,
        args: ['list']
      };

      await handleCli(handlerCtx);

      // Verify the handler was called with correct arguments
      assert.strictEqual(mockHandle.mock.callCount(), 1);
      assert.deepStrictEqual(mockHandle.mock.calls[0].arguments, [mockCtx, ['list']]);

      // Verify reply was called with the result
      assert.strictEqual(mockReply.mock.callCount(), 1);
      assert.strictEqual(mockReply.mock.calls[0].arguments[0], mockResult);
    });

    it('should handle errors gracefully', async () => {
      // Mock the CLI command handler to throw an error
      const mockError = new Error('Backend not found');
      const mockHandle = mock.method(cliCommandHandler, 'handle', () => {
        throw mockError;
      });

      // Mock handler context
      const mockCtx = {
        from: { id: 12345 }
      };
      const mockReply = mock.fn(() => Promise.resolve());
      const handlerCtx = {
        ctx: mockCtx,
        reply: mockReply,
        args: ['invalid-backend']
      };

      await handleCli(handlerCtx);

      // Verify reply was called with error message
      assert.strictEqual(mockReply.mock.callCount(), 1);
      const replyMessage = mockReply.mock.calls[0].arguments[0];
      assert.match(replyMessage, /❌ CLI命令执行错误/);
      assert.match(replyMessage, /Backend not found/);
    });
  });

  describe('CLI command handler instance', () => {
    it('should be created successfully', () => {
      assert.ok(cliCommandHandler);
      assert.strictEqual(typeof cliCommandHandler.handle, 'function');
    });

    it('should have setBackendRegistry method for testing', () => {
      assert.strictEqual(typeof cliCommandHandler.setBackendRegistry, 'function');
    });
  });
});