import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-012 /kill Command Handler', () => {
  let killHandler;
  let replies;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const killPath = new URL(`file://${projectRoot}/src/bot/commands/handlers/kill.js`);
    const module = await import(killPath.href);
    killHandler = module;
    replies = [];
  });

  describe('killMeta', () => {
    test('should export killMeta with command metadata', async () => {
      assert.ok(killHandler.killMeta);
      assert.equal(killHandler.killMeta.name, 'kill');
    });

    test('should have correct minRole for kill command', async () => {
      assert.equal(killHandler.killMeta.minRole, 'admin');
    });

    test('should have description', async () => {
      assert.ok(killHandler.killMeta.description);
    });
  });

  describe('handleKill', () => {
    test('should require PID argument', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: [],
        userId: '12345'
      };

      await killHandler.handleKill(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      assert.ok(replies[0].includes('PID') || replies[0].includes('pid'), 'Should mention PID requirement');
    });

    test('should return error for invalid PID', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['invalid'],
        userId: '12345'
      };

      await killHandler.handleKill(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      assert.ok(replies[0].includes('有效') || replies[0].includes('invalid') || replies[0].includes('PID'), 'Should indicate invalid PID');
    });

    test('should request confirmation for valid PID', async () => {
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['12345'],
        userId: '12345'
      };

      await killHandler.handleKill(handlerCtx);

      assert.ok(replies.length > 0, 'Should send a reply');
      // Should ask for confirmation
      assert.ok(
        replies[0].includes('确认') ||
        replies[0].includes('CONFIRM') ||
        replies[0].includes('确认'),
        'Should request confirmation'
      );
    });
  });

  describe('parsePid', () => {
    test('should parse valid numeric PID', async () => {
      const result = killHandler.parsePid('1234');
      assert.equal(result, 1234);
    });

    test('should return null for non-numeric input', async () => {
      const result = killHandler.parsePid('invalid');
      assert.equal(result, null);
    });

    test('should return null for negative numbers', async () => {
      const result = killHandler.parsePid('-100');
      assert.equal(result, null);
    });

    test('should return null for zero', async () => {
      const result = killHandler.parsePid('0');
      assert.equal(result, null);
    });
  });
});
