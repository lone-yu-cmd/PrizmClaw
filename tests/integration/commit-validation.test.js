/**
 * Integration Tests: Commit Amend and Force Flows
 *
 * F-008: Commit Workflow Integration
 * Tests for amend and force confirmation flows
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createGitService as _createGitService } from '../../src/services/git-service.js';
import { createCommitService } from '../../src/services/commit-service.js';
import { handleCommit, commitMeta as _commitMeta } from '../../src/bot/commands/handlers/commit.js';
import { createMockContext } from '../helpers/mock-telegram.js';
import { setConfigForTesting, resetConfig } from '../../src/security/permission-guard.js';

// Mock factories
function createMockGitService(overrides = {}) {
  return {
    getStatus: async () => overrides.statusResponse || {
      clean: false,
      staged: ['test.js'],
      modified: [],
      untracked: [],
      conflicts: [],
      currentBranch: 'main'
    },
    isClean: async () => false,
    getChangedFiles: async () => ['test.js'],
    commit: async () => overrides.commitResponse || {
      success: true,
      hash: 'test123',
      shortHash: 'test123',
      filesChanged: 1
    },
    amendCommit: async () => overrides.amendResponse || {
      success: true,
      hash: 'amend123',
      shortHash: 'amend12',
      filesChanged: 1
    },
    getLastCommit: async () => overrides.lastCommitResponse || {
      hash: 'prev123',
      shortHash: 'prev123',
      message: 'previous',
      author: 'Test',
      date: new Date().toISOString()
    },
    getCommitLog: async () => [],
    getShortHash: (hash) => hash?.substring(0, 7) || ''
  };
}

function createMockStatusAggregator(running = false) {
  return {
    aggregateStatus: async () => ({
      stage: running ? 'running' : 'idle',
      type: 'feature'
    })
  };
}

function createMockHandlerCtx(overrides = {}) {
  const replies = [];
  return {
    ctx: createMockContext(overrides.ctx),
    parsed: { flags: {} },
    params: {},
    userId: 999999999,
    userRole: 'admin',
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

describe('Integration: Amend Flow', () => {
  let tempDir;
  let testStatusPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amend-test-'));
    testStatusPath = path.join(tempDir, 'test-status.json');

    setConfigForTesting({
      userPermissions: new Map([['999999999', 'admin']])
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    resetConfig();
  });

  describe('T-232: Amend confirmation flow', () => {
    it('requires confirmation for amend operation', async () => {
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

    it('executes amend after CONFIRM', async () => {
      // This test verifies the amend path through the service
      const mockGit = createMockGitService({
        amendResponse: {
          success: true,
          hash: 'confirmed123',
          shortHash: 'confir',
          filesChanged: 2
        }
      });

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: createMockStatusAggregator(false),
        sessionStore: {
          addCommit: () => {},
          getCommits: () => []
        },
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test',
        userId: 'admin',
        message: 'amended message',
        amend: true
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.hash, 'confirmed123');
    });

    it('rejects amend from non-admin', async () => {
      const handlerCtx = createMockHandlerCtx({
        params: { amend: true },
        userId: 888888888, // Non-admin
        userRole: 'operator'
      });

      await handleCommit(handlerCtx);

      const lastReply = handlerCtx._getLastReply();
      assert.ok(lastReply.includes('admin'));
    });
  });
});

describe('Integration: Force Flow', () => {
  let tempDir;
  let testStatusPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'force-test-'));
    testStatusPath = path.join(tempDir, 'test-status.json');

    // Write failing test status
    fs.writeFileSync(testStatusPath, JSON.stringify({
      lastRun: Date.now(),
      passed: 5,
      failed: 2,
      skipped: 0
    }));

    setConfigForTesting({
      userPermissions: new Map([['999999999', 'admin']])
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    resetConfig();
  });

  describe('T-233: Force confirmation flow', () => {
    it('requires confirmation for force operation', async () => {
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

    it('executes force commit after CONFIRM, skipping validation', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(true); // Pipeline running

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: {
          addCommit: () => {},
          getCommits: () => []
        },
        testStatusPath
      });

      // Without force, should fail (pipeline running + tests failing)
      const normalResult = await commitService.commit({
        sessionId: 'test',
        userId: 'user',
        message: 'should fail'
      });
      assert.strictEqual(normalResult.success, false);

      // With force, should succeed
      const forceResult = await commitService.commit({
        sessionId: 'test',
        userId: 'admin',
        message: 'forced commit',
        force: true
      });
      assert.strictEqual(forceResult.success, true);
    });

    it('rejects force from non-admin', async () => {
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
});

describe('Integration: Validation Failure Scenarios', () => {
  let tempDir;
  let testStatusPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-test-'));
    testStatusPath = path.join(tempDir, 'test-status.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('fails when pipeline is running', async () => {
    const mockGit = createMockGitService();
    const mockStatus = createMockStatusAggregator(true);

    const commitService = createCommitService({
      gitService: mockGit,
      statusAggregator: mockStatus,
      sessionStore: { addCommit: () => {}, getCommits: () => [] },
      testStatusPath
    });

    const result = await commitService.commit({
      sessionId: 'test',
      userId: 'user',
      message: 'test'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(e => e.code === 'PIPELINE_RUNNING'));
  });

  it('fails when tests are failing', async () => {
    fs.writeFileSync(testStatusPath, JSON.stringify({
      lastRun: Date.now(),
      passed: 5,
      failed: 3,
      skipped: 0
    }));

    const mockGit = createMockGitService();
    const mockStatus = createMockStatusAggregator(false);

    const commitService = createCommitService({
      gitService: mockGit,
      statusAggregator: mockStatus,
      sessionStore: { addCommit: () => {}, getCommits: () => [] },
      testStatusPath
    });

    const result = await commitService.commit({
      sessionId: 'test',
      userId: 'user',
      message: 'test'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(e => e.code === 'TEST_FAILED'));
  });

  it('fails when nothing to commit', async () => {
    const mockGit = createMockGitService({
      statusResponse: {
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: [],
        currentBranch: 'main'
      }
    });

    const commitService = createCommitService({
      gitService: mockGit,
      statusAggregator: createMockStatusAggregator(false),
      sessionStore: { addCommit: () => {}, getCommits: () => [] },
      testStatusPath
    });

    const result = await commitService.commit({
      sessionId: 'test',
      userId: 'user',
      message: 'test'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(e => e.code === 'NOTHING_TO_COMMIT'));
  });

  it('fails when merge conflicts exist', async () => {
    const mockGit = createMockGitService({
      statusResponse: {
        clean: false,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: ['conflict.js'],
        currentBranch: 'main'
      }
    });

    const commitService = createCommitService({
      gitService: mockGit,
      statusAggregator: createMockStatusAggregator(false),
      sessionStore: { addCommit: () => {}, getCommits: () => [] },
      testStatusPath
    });

    const result = await commitService.commit({
      sessionId: 'test',
      userId: 'user',
      message: 'test'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(e => e.code === 'MERGE_CONFLICT'));
  });

  it('returns multiple errors when multiple conditions fail', async () => {
    fs.writeFileSync(testStatusPath, JSON.stringify({
      lastRun: Date.now(),
      passed: 5,
      failed: 3,
      skipped: 0
    }));

    const mockGit = createMockGitService({
      statusResponse: {
        clean: false,
        staged: ['test.js'],
        modified: [],
        untracked: [],
        conflicts: ['conflict.js'],
        currentBranch: 'main'
      }
    });
    const mockStatus = createMockStatusAggregator(true); // running

    const commitService = createCommitService({
      gitService: mockGit,
      statusAggregator: mockStatus,
      sessionStore: { addCommit: () => {}, getCommits: () => [] },
      testStatusPath
    });

    const result = await commitService.commit({
      sessionId: 'test',
      userId: 'user',
      message: 'test'
    });

    assert.strictEqual(result.success, false);
    // Should have multiple errors
    assert.ok(result.errors.length >= 2);
  });
});
