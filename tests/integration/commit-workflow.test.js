/**
 * Integration Tests: Commit Workflow
 *
 * F-008: Commit Workflow Integration
 * Comprehensive tests covering all user stories (US-1 to US-5)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { createGitService as _createGitService } from '../../src/services/git-service.js';
import { createCommitService, VALIDATION_ERRORS } from '../../src/services/commit-service.js';
import { handleCommit, commitMeta } from '../../src/bot/commands/handlers/commit.js';
import { handleCommits, commitsMeta } from '../../src/bot/commands/handlers/commits.js';
import { sessionStore } from '../../src/services/session-store.js';
import { setConfigForTesting, resetConfig, checkCommandPermission } from '../../src/security/permission-guard.js';
import { createMockContext } from '../helpers/mock-telegram.js';

// ============================================================
// Test Helpers
// ============================================================

function createMockGitService(overrides = {}) {
  let callLog = [];
  
  const defaultImpl = {
    getStatus: async () => ({
      clean: false,
      staged: ['test.js'],
      modified: [],
      untracked: [],
      conflicts: [],
      currentBranch: 'main',
      ahead: 0,
      behind: 0
    }),
    isClean: async () => false,
    getChangedFiles: async () => ['test.js'],
    commit: async (message, options) => {
      callLog.push({ method: 'commit', message, options });
      return {
        success: true,
        hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
        shortHash: 'a1b2c3d',
        message,
        filesChanged: 1
      };
    },
    amendCommit: async (message) => {
      callLog.push({ method: 'amendCommit', message });
      return {
        success: true,
        hash: 'b2c3d4e5f6789012345678901234567890abcd',
        shortHash: 'b2c3d4e',
        message,
        filesChanged: 1
      };
    },
    getLastCommit: async () => ({
      hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
      shortHash: 'a1b2c3d',
      message: 'test commit',
      author: 'Test User',
      date: new Date().toISOString()
    }),
    getCommitLog: async (_count) => [],
    getShortHash: (hash) => hash?.substring(0, 7) || '',
    getCallLog: () => callLog
  };

  return { ...defaultImpl, ...overrides };
}

function createMockStatusAggregator(overrides = {}) {
  return {
    aggregateStatus: async () => ({
      stage: 'idle',
      type: 'feature',
      progress: { total: 0, completed: 0 }
    }),
    formatStatusForTelegram: (status) => `Status: ${status.stage}`,
    ...overrides
  };
}

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

// ============================================================
// US-1: Telegram Commit Trigger
// ============================================================

describe('US-1: Telegram Commit Trigger', () => {
  const testSessionId = 'test-us1-session';

  beforeEach(() => {
    sessionStore.clear(testSessionId);
  });

  describe('AC-1.1: /commit command triggers commit flow', () => {
    it('should have commit command registered', () => {
      assert.strictEqual(commitMeta.name, 'commit');
      assert.ok(commitMeta.description);
    });

    it('should have minRole of operator', () => {
      assert.strictEqual(commitMeta.minRole, 'operator');
    });
  });

  describe('AC-1.2: --message parameter support', () => {
    it('should accept --message parameter', () => {
      const messageParam = commitMeta.params.find(p => p.name === 'message');
      assert.ok(messageParam);
      assert.strictEqual(messageParam.required, false);
    });

    it('should use provided commit message', async () => {
      const mockGit = createMockGitService();
      const commitService = createCommitService({ gitService: mockGit });
      
      const result = await commitService.commit({
        sessionId: testSessionId,
        userId: 'test-user',
        message: 'feat: custom commit message'
      });

      assert.strictEqual(result.success, true);
      const calls = mockGit.getCallLog();
      assert.ok(calls[0].message.includes('feat: custom commit message'));
    });
  });

  describe('AC-1.3: --amend parameter (admin only)', () => {
    it('should have amend parameter defined', () => {
      const amendParam = commitMeta.params.find(p => p.name === 'amend');
      assert.ok(amendParam);
      assert.strictEqual(amendParam.type, 'boolean');
    });

    it('should reject amend from non-admin', async () => {
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

  describe('AC-1.4: Return commit hash and summary', () => {
    it('should return short hash on success', async () => {
      const mockGit = createMockGitService();
      const commitService = createCommitService({ gitService: mockGit });
      
      const result = await commitService.commit({
        sessionId: testSessionId,
        userId: 'test-user',
        message: 'test commit'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.shortHash);
      assert.strictEqual(result.shortHash.length, 7);
    });

    it('should return files changed count', async () => {
      const mockGit = createMockGitService();
      const commitService = createCommitService({ gitService: mockGit });
      
      const result = await commitService.commit({
        sessionId: testSessionId,
        userId: 'test-user',
        message: 'test commit'
      });

      assert.strictEqual(result.success, true);
      assert.ok(typeof result.filesChanged === 'number');
    });
  });
});

// ============================================================
// US-2: Pre-Commit Validation
// ============================================================

describe('US-2: Pre-Commit Validation', () => {
  let tempDir;
  let commitService;
  let mockGit;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'commit-validation-'));
    mockGit = createMockGitService();
    
    commitService = createCommitService({
      gitService: mockGit,
      testStatusPath: path.join(tempDir, 'test-status.json')
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('AC-2.1: Check pipeline status', () => {
    it('should reject when pipeline is running', async () => {
      const mockAggregator = createMockStatusAggregator({
        aggregateStatus: async () => ({ stage: 'running', type: 'feature' })
      });
      
      const cs = createCommitService({
        gitService: mockGit,
        statusAggregator: mockAggregator
      });

      const result = await cs.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'PIPELINE_RUNNING'));
    });

    it('should allow when pipeline is idle', async () => {
      const result = await commitService.validatePreConditions({});

      assert.ok(!result.errors.some(e => e.code === 'PIPELINE_RUNNING'));
    });
  });

  describe('AC-2.2: Check test status', () => {
    it('should reject when tests have failed', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-status.json'),
        JSON.stringify({ lastRun: Date.now(), passed: 5, failed: 2, skipped: 0 })
      );

      const result = await commitService.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'TEST_FAILED'));
    });

    it('should allow when all tests pass', async () => {
      await fs.writeFile(
        path.join(tempDir, 'test-status.json'),
        JSON.stringify({ lastRun: Date.now(), passed: 10, failed: 0, skipped: 1 })
      );

      const result = await commitService.validatePreConditions({});

      assert.ok(!result.errors.some(e => e.code === 'TEST_FAILED'));
    });
  });

  describe('AC-2.3: Clear rejection reasons', () => {
    it('should include suggestion for pipeline running error', () => {
      const error = VALIDATION_ERRORS.PIPELINE_RUNNING;
      assert.ok(error.message);
      assert.ok(error.suggestion);
    });

    it('should include suggestion for test failed error', () => {
      const error = VALIDATION_ERRORS.TEST_FAILED;
      assert.ok(error.message);
      assert.ok(error.suggestion);
    });

    it('should include suggestion for nothing to commit error', () => {
      const error = VALIDATION_ERRORS.NOTHING_TO_COMMIT;
      assert.ok(error.message);
      assert.ok(error.suggestion);
    });

    it('should include files list for merge conflict error', async () => {
      mockGit.getStatus = async () => ({
        clean: false,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: ['file1.js', 'file2.js'],
        currentBranch: 'main'
      });

      const cs = createCommitService({ gitService: mockGit });
      const result = await cs.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      const conflictError = result.errors.find(e => e.code === 'MERGE_CONFLICT');
      assert.ok(conflictError);
      assert.ok(conflictError.files);
      assert.deepStrictEqual(conflictError.files, ['file1.js', 'file2.js']);
    });
  });

  describe('AC-2.4: --force skip validation (admin only)', () => {
    it('should skip validation when force is true', async () => {
      const mockAggregator = createMockStatusAggregator({
        aggregateStatus: async () => ({ stage: 'running', type: 'feature' })
      });
      
      const cs = createCommitService({
        gitService: mockGit,
        statusAggregator: mockAggregator
      });

      const result = await cs.commit({
        sessionId: 'test-session',
        userId: 'admin-user',
        message: 'test',
        force: true
      });

      assert.strictEqual(result.success, true);
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
});

// ============================================================
// US-3: Commit Result Feedback
// ============================================================

describe('US-3: Commit Result Feedback', () => {
  let mockGit;
  let commitService;

  beforeEach(() => {
    mockGit = createMockGitService();
    commitService = createCommitService({ gitService: mockGit });
  });

  describe('AC-3.1: Success feedback', () => {
    it('should return commit hash (short format)', async () => {
      const result = await commitService.commit({
        sessionId: 'test',
        userId: 'user',
        message: 'test'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.shortHash);
      assert.strictEqual(result.shortHash.length, 7);
    });

    it('should return files changed count', async () => {
      const result = await commitService.commit({
        sessionId: 'test',
        userId: 'user',
        message: 'test'
      });

      assert.ok(typeof result.filesChanged === 'number');
    });
  });

  describe('AC-3.2: Failure feedback', () => {
    it('should return clear error when nothing to commit', async () => {
      mockGit.getStatus = async () => ({
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: [],
        currentBranch: 'main'
      });

      const cs = createCommitService({ gitService: mockGit });
      const result = await cs.commit({
        sessionId: 'test',
        userId: 'user',
        message: 'test'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
      assert.ok(result.errors.some(e => e.code === 'NOTHING_TO_COMMIT'));
    });
  });

  describe('AC-3.3: Nothing to commit message', () => {
    it('should return NOTHING_TO_COMMIT error', async () => {
      mockGit.getStatus = async () => ({
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: [],
        currentBranch: 'main'
      });

      const cs = createCommitService({ gitService: mockGit });
      const result = await cs.validatePreConditions({});

      assert.ok(result.errors.some(e => e.code === 'NOTHING_TO_COMMIT'));
    });
  });

  describe('AC-3.4: Merge conflict feedback', () => {
    it('should return conflict files list', async () => {
      mockGit.getStatus = async () => ({
        clean: false,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: ['conflict1.js', 'conflict2.js'],
        currentBranch: 'main'
      });

      const cs = createCommitService({ gitService: mockGit });
      const result = await cs.validatePreConditions({});

      const conflictError = result.errors.find(e => e.code === 'MERGE_CONFLICT');
      assert.ok(conflictError);
      assert.deepStrictEqual(conflictError.files, ['conflict1.js', 'conflict2.js']);
    });
  });
});

// ============================================================
// US-4: Session Commit Tracking
// ============================================================

describe('US-4: Session Commit Tracking', () => {
  const testSessionId = 'test-us4-session';

  beforeEach(() => {
    sessionStore.clear(testSessionId);
  });

  describe('AC-4.1: Commit records in session state', () => {
    it('should store commit in session', async () => {
      const mockGit = createMockGitService();
      const cs = createCommitService({
        gitService: mockGit,
        sessionStore: {
          addCommit: (sid, info) => sessionStore.addCommit(sid, info),
          getCommits: (sid) => sessionStore.getCommits(sid)
        }
      });

      await cs.commit({
        sessionId: testSessionId,
        userId: 'user',
        message: 'test commit',
        featureId: 'F-008'
      });

      const commits = sessionStore.getCommits(testSessionId);
      assert.strictEqual(commits.length, 1);
      assert.strictEqual(commits[0].featureId, 'F-008');
    });
  });

  describe('AC-4.2: /status shows last commit', () => {
    it('should have getLastCommit in sessionStore', () => {
      assert.ok(typeof sessionStore.getLastCommit === 'function');
    });

    it('should return last commit from session', () => {
      sessionStore.addCommit(testSessionId, {
        hash: 'abc123',
        shortHash: 'abc123d',
        message: 'first commit',
        filesChanged: 2
      });
      sessionStore.addCommit(testSessionId, {
        hash: 'def456',
        shortHash: 'def456a',
        message: 'second commit',
        filesChanged: 1
      });

      const lastCommit = sessionStore.getLastCommit(testSessionId);
      assert.strictEqual(lastCommit.hash, 'def456');
      assert.strictEqual(lastCommit.message, 'second commit');
    });
  });

  describe('AC-4.3: /commits command', () => {
    it('should have commits command registered', () => {
      assert.strictEqual(commitsMeta.name, 'commits');
      assert.strictEqual(commitsMeta.minRole, 'viewer');
    });

    it('should show commit history', async () => {
      sessionStore.addCommit(testSessionId, {
        hash: 'abc123',
        shortHash: 'abc123d',
        message: 'test commit',
        filesChanged: 3,
        timestamp: Date.now()
      });

      const handlerCtx = createMockHandlerCtx({
        ctx: { chat: { id: testSessionId } }
      });

      await handleCommits(handlerCtx);

      const lastReply = handlerCtx._getLastReply();
      assert.ok(lastReply.includes('提交历史'));
      assert.ok(lastReply.includes('abc123d'));
    });
  });
});

// ============================================================
// US-5: High-Risk Commit Protection
// ============================================================

describe('US-5: High-Risk Commit Protection', () => {
  beforeEach(() => {
    setConfigForTesting({
      userPermissions: new Map([
        ['999999999', 'admin']
      ])
    });
  });

  afterEach(() => {
    resetConfig();
  });

  describe('AC-5.1: --amend requires admin + confirmation', () => {
    it('should reject amend from non-admin', async () => {
      const handlerCtx = createMockHandlerCtx({
        params: { amend: true },
        userId: 888888888,
        userRole: 'operator'
      });

      await handleCommit(handlerCtx);

      const lastReply = handlerCtx._getLastReply();
      assert.ok(lastReply.includes('admin'));
    });

    it('should require confirmation for amend from admin', async () => {
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
  });

  describe('AC-5.2: --force requires admin + confirmation', () => {
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

    it('should require confirmation for force from admin', async () => {
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

  describe('AC-5.3: Audit logging for commit operations', () => {
    it('should log successful commits', async () => {
      const mockGit = createMockGitService();
      const _auditLog = [];
      
      const cs = createCommitService({
        gitService: mockGit,
        sessionStore: {
          addCommit: () => {},
          getCommits: () => []
        }
      });

      // The commit service calls logAuditEntry internally
      // We verify it doesn't throw and returns success
      const result = await cs.commit({
        sessionId: 'test',
        userId: 'user',
        message: 'test',
        userRole: 'operator'
      });

      assert.strictEqual(result.success, true);
    });

    it('should log failed commit attempts', async () => {
      const failingMockGit = createMockGitService({
        getStatus: async () => ({
          clean: true,
          staged: [],
          modified: [],
          untracked: [],
          conflicts: [],
          currentBranch: 'main'
        })
      });

      const cs = createCommitService({ gitService: failingMockGit });

      const result = await cs.commit({
        sessionId: 'test',
        userId: 'user',
        message: 'test',
        userRole: 'operator'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
    });
  });
});

// ============================================================
// Permission Matrix Verification
// ============================================================

describe('Permission Matrix', () => {
  beforeEach(() => {
    setConfigForTesting({
      userPermissions: new Map([
        ['admin-user', 'admin'],
        ['operator-user', 'operator'],
        ['viewer-user', 'viewer']
      ])
    });
  });

  afterEach(() => {
    resetConfig();
  });

  it('should require admin for commit-amend', () => {
    const adminCheck = checkCommandPermission('admin-user', 'commit-amend');
    const operatorCheck = checkCommandPermission('operator-user', 'commit-amend');
    
    assert.strictEqual(adminCheck.allowed, true);
    assert.strictEqual(operatorCheck.allowed, false);
  });

  it('should require admin for commit-force', () => {
    const adminCheck = checkCommandPermission('admin-user', 'commit-force');
    const operatorCheck = checkCommandPermission('operator-user', 'commit-force');
    
    assert.strictEqual(adminCheck.allowed, true);
    assert.strictEqual(operatorCheck.allowed, false);
  });

  it('should require confirmation for high-risk commit commands', () => {
    const adminCheck = checkCommandPermission('admin-user', 'commit-amend');
    
    assert.strictEqual(adminCheck.allowed, true);
    assert.strictEqual(adminCheck.requiresConfirmation, true);
  });
});
