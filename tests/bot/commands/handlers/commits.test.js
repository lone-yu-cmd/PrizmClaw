/**
 * Commits Handler Unit Tests
 * F-008: Commit Workflow Integration
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { handleCommits, commitsMeta } from '../../../../src/bot/commands/handlers/commits.js';
import { createMockContext } from '../../../helpers/mock-telegram.js';
import { sessionStore } from '../../../../src/services/session-store.js';

function createMockHandlerCtx(overrides = {}) {
  const ctx = createMockContext(overrides.ctx);
  const replies = [];

  return {
    ctx,
    parsed: { flags: {} },
    params: {},
    userId: 123456789,
    userRole: 'viewer',
    reply: async (text) => {
      replies.push(text);
      return { message_id: replies.length };
    },
    _getReplies: () => replies,
    _getLastReply: () => replies[replies.length - 1],
    ...overrides
  };
}

describe('commitsMeta', () => {
  it('should have correct name', () => {
    assert.strictEqual(commitsMeta.name, 'commits');
  });

  it('should have aliases', () => {
    assert.ok(commitsMeta.aliases.includes('history'));
  });

  it('should have minRole of viewer', () => {
    assert.strictEqual(commitsMeta.minRole, 'viewer');
  });
});

describe('handleCommits', () => {
  const testSessionId = '123456789';

  beforeEach(() => {
    // Clear session commits
    sessionStore.clear(testSessionId);
  });

  it('should show empty message when no commits', async () => {
    const handlerCtx = createMockHandlerCtx();
    await handleCommits(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('暂无提交记录'));
  });

  it('should show commits list when commits exist', async () => {
    // Add test commits
    sessionStore.addCommit(testSessionId, {
      hash: 'abc123def456',
      shortHash: 'abc123d',
      message: 'test commit 1',
      filesChanged: 2,
      timestamp: Date.now()
    });

    const handlerCtx = createMockHandlerCtx();
    await handleCommits(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('提交历史'));
    assert.ok(lastReply.includes('abc123d'));
  });

  it('should respect count parameter', async () => {
    // Add multiple commits
    for (let i = 0; i < 15; i++) {
      sessionStore.addCommit(testSessionId, {
        hash: `hash${i}`,
        shortHash: `short${i}`,
        message: `commit ${i}`,
        filesChanged: 1,
        timestamp: Date.now() + i
      });
    }

    const handlerCtx = createMockHandlerCtx({
      params: { count: 5 }
    });
    await handleCommits(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    // Should only show 5 commits
    assert.ok(lastReply.includes('5 条提交记录'));
  });

  it('should show feature ID if present', async () => {
    sessionStore.addCommit(testSessionId, {
      hash: 'abc123',
      shortHash: 'abc1234',
      message: 'test',
      filesChanged: 1,
      featureId: 'F-008',
      timestamp: Date.now()
    });

    const handlerCtx = createMockHandlerCtx();
    await handleCommits(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('Feature: F-008'));
  });

  it('should show bugfix ID if present', async () => {
    sessionStore.addCommit(testSessionId, {
      hash: 'abc123',
      shortHash: 'abc1234',
      message: 'test',
      filesChanged: 1,
      bugfixId: 'BF-001',
      timestamp: Date.now()
    });

    const handlerCtx = createMockHandlerCtx();
    await handleCommits(handlerCtx);

    const lastReply = handlerCtx._getLastReply();
    assert.ok(lastReply.includes('Bugfix: BF-001'));
  });
});
