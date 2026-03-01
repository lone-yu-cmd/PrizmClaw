/**
 * Commit Handler Unit Tests
 * F-008: Commit Workflow Integration
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handleCommit, commitMeta } from '../../../../src/bot/commands/handlers/commit.js';
import { createMockContext } from '../../../helpers/mock-telegram.js';
import { setConfigForTesting, resetConfig } from '../../../../src/security/permission-guard.js';

function createMockHandlerCtx(overrides = {}) {
  const ctx = createMockContext(overrides.ctx);
  const replies = [];

  return {
    ctx,
    parsed: { flags: {} },
    params: {},
    userId: 123456789,
    userRole: 'operator',
    requiresConfirmation: false,
    reply: async (text) => {
      replies.push(text);
      return { message_id: replies.length };
    },
    _getReplies: () => replies,
    _getLastReply: () => replies[replies.length - 1],
    ...overrides
  };
}

describe('commitMeta', () => {
  it('should have correct name', () => {
    assert.strictEqual(commitMeta.name, 'commit');
  });

  it('should have aliases', () => {
    assert.ok(commitMeta.aliases.includes('c'));
  });

  it('should have minRole of operator', () => {
    assert.strictEqual(commitMeta.minRole, 'operator');
  });

  it('should have params defined', () => {
    assert.ok(commitMeta.params.length > 0);
  });

  it('should have help text', () => {
    assert.ok(commitMeta.helpText);
  });
});

describe('handleCommit - Parameter Validation', () => {
  it('should reject commit message over 500 characters', async () => {
    const longMessage = 'a'.repeat(501);
    const handlerCtx = createMockHandlerCtx({
      params: { message: longMessage }
    });

    await handleCommit(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('过长'));
  });

  it('should accept commit message at 500 characters', async () => {
    const maxMessage = 'a'.repeat(500);
    const handlerCtx = createMockHandlerCtx({
      params: { message: maxMessage }
    });

    await handleCommit(handlerCtx);

    // Should not reject for length (may fail for other reasons)
    const lastReply = handlerCtx._getLastReply();
    assert.ok(!lastReply.includes('过长'));
  });
});

describe('handleCommit - Permission Checks', () => {
  it('should reject amend from non-admin', async () => {
    // User is not in the admin list
    const handlerCtx = createMockHandlerCtx({
      params: { amend: true },
      userId: 888888888,
      userRole: 'operator'
    });

    await handleCommit(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('admin'));
  });

  it('should reject force from non-admin', async () => {
    const handlerCtx = createMockHandlerCtx({
      params: { force: true },
      userId: 888888888,
      userRole: 'operator'
    });

    await handleCommit(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('admin'));
  });
});

describe('handleCommit - Confirmation Flow', () => {
  beforeEach(() => {
    // Set up test config with admin user
    setConfigForTesting({
      userPermissions: new Map([
        ['999999999', 'admin']
      ])
    });
  });

  afterEach(() => {
    resetConfig();
  });

  it('should create confirmation for amend operation', async () => {
    const handlerCtx = createMockHandlerCtx({
      params: { amend: true },
      userId: 999999999,
      userRole: 'admin',
      requiresConfirmation: true
    });

    await handleCommit(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('确认'));
  });

  it('should create confirmation for force operation', async () => {
    const handlerCtx = createMockHandlerCtx({
      params: { force: true },
      userId: 999999999,
      userRole: 'admin',
      requiresConfirmation: true
    });

    await handleCommit(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('确认'));
  });
});

describe('handleCommit - Error Handling', () => {
  it('should handle commit failure gracefully', async () => {
    const handlerCtx = createMockHandlerCtx({
      params: { message: 'test commit' }
    });

    await handleCommit(handlerCtx);

    // Should have a reply (either success or failure)
    const replies = handlerCtx._getReplies();
    assert.ok(replies.length > 0);
  });
});
