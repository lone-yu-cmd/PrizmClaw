/**
 * CommitService Unit Tests
 * F-008: Commit Workflow Integration
 *
 * Tests for commit workflow orchestration.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createCommitService, VALIDATION_ERRORS, getErrorSuggestion } from '../../src/services/commit-service.js';
import { createGitService } from '../../src/services/git-service.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock factories
function createMockGitService() {
  return {
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
    commit: async () => ({
      success: true,
      hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
      shortHash: 'a1b2c3d',
      filesChanged: 1
    }),
    amendCommit: async () => ({
      success: true,
      hash: 'b2c3d4e5f6789012345678901234567890abcd',
      shortHash: 'b2c3d4e'
    }),
    getLastCommit: async () => ({
      hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
      shortHash: 'a1b2c3d',
      message: 'test commit',
      author: 'Test User',
      date: new Date().toISOString()
    }),
    getCommitLog: async () => [],
    getShortHash: (hash) => hash.substring(0, 7)
  };
}

function createMockStatusAggregator() {
  return {
    aggregateStatus: async () => ({
      stage: 'idle',
      type: 'feature',
      progress: { total: 0, completed: 0 }
    })
  };
}

function createMockSessionStore() {
  const sessions = new Map();

  return {
    getSession: (sessionId) => sessions.get(sessionId) || null,
    saveSession: (session) => {
      sessions.set(session.sessionId, session);
    },
    addCommit: (sessionId, commitInfo) => {
      const session = sessions.get(sessionId) || {
        sessionId,
        commits: []
      };
      session.commits = session.commits || [];
      session.commits.push({
        ...commitInfo,
        timestamp: Date.now()
      });
      sessions.set(sessionId, session);
    },
    getCommits: (sessionId) => {
      const session = sessions.get(sessionId);
      return session?.commits || [];
    }
  };
}

describe('CommitService', () => {
  let commitService;
  let mockGitService;
  let mockStatusAggregator;
  let mockSessionStore;
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-service-test-'));
    mockGitService = createMockGitService();
    mockStatusAggregator = createMockStatusAggregator();
    mockSessionStore = createMockSessionStore();

    commitService = createCommitService({
      gitService: mockGitService,
      statusAggregator: mockStatusAggregator,
      sessionStore: mockSessionStore,
      testStatusPath: path.join(testDir, 'test-status.json')
    });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('validatePreConditions()', () => {
    it('should return valid when all checks pass', async () => {
      // No test status file = no failed tests
      const result = await commitService.validatePreConditions({});

      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('should return error when pipeline is running', async () => {
      mockStatusAggregator.aggregateStatus = async () => ({
        stage: 'running',
        type: 'feature'
      });

      const result = await commitService.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'PIPELINE_RUNNING'));
    });

    it('should return error when tests failed', async () => {
      fs.writeFileSync(path.join(testDir, 'test-status.json'), JSON.stringify({
        lastRun: Date.now(),
        passed: 5,
        failed: 2,
        skipped: 0
      }));

      const result = await commitService.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'TEST_FAILED'));
    });

    it('should return error when nothing to commit', async () => {
      mockGitService.getStatus = async () => ({
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: [],
        currentBranch: 'main'
      });

      const result = await commitService.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'NOTHING_TO_COMMIT'));
    });

    it('should return error when merge conflicts exist', async () => {
      mockGitService.getStatus = async () => ({
        clean: false,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: ['conflicted-file.js'],
        currentBranch: 'main'
      });

      const result = await commitService.validatePreConditions({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.code === 'MERGE_CONFLICT'));
    });

    it('should skip pipeline check when skipPipelineCheck is true', async () => {
      mockStatusAggregator.aggregateStatus = async () => ({
        stage: 'running',
        type: 'feature'
      });

      const result = await commitService.validatePreConditions({
        skipPipelineCheck: true
      });

      // Should not have PIPELINE_RUNNING error
      assert.ok(!result.errors.some(e => e.code === 'PIPELINE_RUNNING'));
    });

    it('should skip test check when skipTestCheck is true', async () => {
      fs.writeFileSync(path.join(testDir, 'test-status.json'), JSON.stringify({
        lastRun: Date.now(),
        passed: 5,
        failed: 2,
        skipped: 0
      }));

      const result = await commitService.validatePreConditions({
        skipTestCheck: true
      });

      // Should not have TEST_FAILED error
      assert.ok(!result.errors.some(e => e.code === 'TEST_FAILED'));
    });

    it('should return gitStatus in result', async () => {
      const result = await commitService.validatePreConditions({});

      assert.ok(result.gitStatus);
      assert.ok(result.gitStatus.currentBranch);
    });
  });

  describe('commit()', () => {
    it('should execute full commit flow', async () => {
      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: add feature'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.hash);
      assert.ok(result.shortHash);
    });

    it('should record commit to session', async () => {
      await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: add feature',
        featureId: 'F-008'
      });

      const commits = mockSessionStore.getCommits('test-session');
      assert.strictEqual(commits.length, 1);
      assert.strictEqual(commits[0].featureId, 'F-008');
    });

    it('should return validation errors without committing', async () => {
      mockGitService.getStatus = async () => ({
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
        conflicts: [],
        currentBranch: 'main'
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: add feature'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
      assert.ok(result.errors.some(e => e.code === 'NOTHING_TO_COMMIT'));
    });

    it('should skip validation when force is true', async () => {
      mockStatusAggregator.aggregateStatus = async () => ({
        stage: 'running',
        type: 'feature'
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: add feature',
        force: true
      });

      assert.strictEqual(result.success, true);
    });

    it('should use amend when amend option is true', async () => {
      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'amended message',
        amend: true
      });

      assert.strictEqual(result.success, true);
    });
  });

  describe('recordCommit()', () => {
    it('should add commit to session store', async () => {
      await commitService.recordCommit('test-session', {
        hash: 'abc123',
        shortHash: 'abc1234',
        message: 'test commit',
        author: 'test-user',
        filesChanged: 3,
        featureId: 'F-008'
      });

      const commits = mockSessionStore.getCommits('test-session');
      assert.strictEqual(commits.length, 1);
      assert.strictEqual(commits[0].hash, 'abc123');
      assert.strictEqual(commits[0].featureId, 'F-008');
    });
  });

  describe('getSessionCommits()', () => {
    it('should return commits for a session', async () => {
      mockSessionStore.addCommit('test-session', {
        hash: 'abc123',
        message: 'first commit'
      });
      mockSessionStore.addCommit('test-session', {
        hash: 'def456',
        message: 'second commit'
      });

      const commits = await commitService.getSessionCommits('test-session');

      assert.strictEqual(commits.length, 2);
    });

    it('should return empty array for non-existent session', async () => {
      const commits = await commitService.getSessionCommits('non-existent');

      assert.deepStrictEqual(commits, []);
    });
  });

  describe('checkPipelineStatus()', () => {
    it('should return isRunning false when pipeline is idle', async () => {
      const result = await commitService.checkPipelineStatus();

      assert.strictEqual(result.isRunning, false);
      assert.strictEqual(result.phase, 'idle');
    });

    it('should return isRunning true when pipeline is running', async () => {
      mockStatusAggregator.aggregateStatus = async () => ({
        stage: 'running',
        type: 'feature'
      });

      const result = await commitService.checkPipelineStatus();

      assert.strictEqual(result.isRunning, true);
    });
  });

  describe('checkTestStatus()', () => {
    it('should return passed true when no test status file', async () => {
      const result = commitService.checkTestStatus();

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.failed, 0);
    });

    it('should return failed count from test status file', async () => {
      fs.writeFileSync(path.join(testDir, 'test-status.json'), JSON.stringify({
        lastRun: Date.now(),
        passed: 10,
        failed: 2,
        skipped: 1
      }));

      const result = commitService.checkTestStatus();

      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.failed, 2);
      assert.strictEqual(result.total, 13);
    });
  });

  describe('buildCommitMessage()', () => {
    it('should build message with feature footer', async () => {
      const result = commitService.buildCommitMessage('test message', { featureId: 'F-008' });

      assert.ok(result.includes('test message'));
      assert.ok(result.includes('Feature: F-008'));
    });

    it('should build message with bugfix footer', async () => {
      const result = commitService.buildCommitMessage('fix bug', { bugfixId: 'BF-001' });

      assert.ok(result.includes('fix bug'));
      assert.ok(result.includes('Bugfix: BF-001'));
    });
  });
});

describe('getErrorSuggestion()', () => {
  it('should return error with suggestion', () => {
    const result = getErrorSuggestion('PIPELINE_RUNNING');
    assert.strictEqual(result.code, 'PIPELINE_RUNNING');
    assert.ok(result.suggestion);
  });

  it('should return default for unknown code', () => {
    const result = getErrorSuggestion('UNKNOWN');
    assert.strictEqual(result.code, 'UNKNOWN');
    assert.strictEqual(result.message, '未知错误');
  });
});
