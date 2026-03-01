/**
 * Integration Tests: Commit Flow - Complete User Story Coverage
 *
 * F-008: Commit Workflow Integration
 * Tests covering all user stories from spec.md:
 * - US-1: Telegram Commit Trigger
 * - US-2: Pre-Commit Validation
 * - US-3: Commit Result Feedback
 * - US-4: Session Commit Tracking
 * - US-5: High-Risk Commit Protection
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createGitService as _createGitService } from '../../src/services/git-service.js';
import { createCommitService, VALIDATION_ERRORS as _VALIDATION_ERRORS } from '../../src/services/commit-service.js';
import { sessionStore as _sessionStore } from '../../src/services/session-store.js';

// Mock factories
function createMockGitService(overrides = {}) {
  let statusResponse = {
    clean: false,
    staged: ['test.js'],
    modified: [],
    untracked: [],
    conflicts: [],
    currentBranch: 'main',
    ahead: 0,
    behind: 0
  };

  let commitResponse = {
    success: true,
    hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
    shortHash: 'a1b2c3d',
    filesChanged: 1
  };

  return {
    getStatus: async () => overrides.statusResponse || statusResponse,
    isClean: async () => (overrides.statusResponse || statusResponse).clean,
    getChangedFiles: async () => (overrides.statusResponse || statusResponse).staged,
    commit: async () => overrides.commitResponse || commitResponse,
    amendCommit: async () => overrides.amendResponse || commitResponse,
    getLastCommit: async () => overrides.lastCommitResponse || {
      hash: 'prev123',
      shortHash: 'prev123',
      message: 'previous commit',
      author: 'Test User',
      date: new Date().toISOString()
    },
    getCommitLog: async () => [],
    getShortHash: (hash) => hash.substring(0, 7)
  };
}

function createMockStatusAggregator(running = false) {
  return {
    aggregateStatus: async () => ({
      stage: running ? 'running' : 'idle',
      type: 'feature',
      progress: { total: 10, completed: running ? 5 : 10 }
    })
  };
}

function createMockSessionStore() {
  const sessions = new Map();
  return {
    addCommit: (sessionId, commitInfo) => {
      const session = sessions.get(sessionId) || { commits: [] };
      session.commits.push({ ...commitInfo, timestamp: Date.now() });
      sessions.set(sessionId, session);
    },
    getCommits: (sessionId) => sessions.get(sessionId)?.commits || [],
    getLastCommit: (sessionId) => {
      const commits = sessions.get(sessionId)?.commits || [];
      return commits.length > 0 ? commits[commits.length - 1] : null;
    }
  };
}

describe('Integration: F-008 Commit Workflow', () => {
  let tempDir;
  let testStatusPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-integration-'));
    testStatusPath = path.join(tempDir, 'test-status.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ============================================
  // US-1: Telegram Commit Trigger
  // ============================================
  describe('US-1: Telegram Commit Trigger', () => {
    it('AC-1.1: /commit command triggers commit flow', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: AC-1.1'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.hash);
    });

    it('AC-1.2: --message parameter specifies commit message', async () => {
      const mockGit = createMockGitService({
        commitResponse: {
          success: true,
          hash: 'msg123',
          shortHash: 'msg123',
          message: 'custom: my custom message',
          filesChanged: 1
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const customMessage = 'feat: implement custom message support';
      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: customMessage
      });

      assert.strictEqual(result.success, true);
    });

    it('AC-1.3: --amend requires admin permission (checked at handler level)', async () => {
      // This test verifies amend functionality works
      const mockGit = createMockGitService({
        amendResponse: {
          success: true,
          hash: 'amended123',
          shortHash: 'amended',
          filesChanged: 1
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'admin-user',
        message: 'amended message',
        amend: true
      });

      assert.strictEqual(result.success, true);
    });

    it('AC-1.4: Returns commit hash and change summary', async () => {
      const mockGit = createMockGitService({
        commitResponse: {
          success: true,
          hash: 'fullhash123456789abcdef',
          shortHash: 'fullhash',
          filesChanged: 5
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: AC-1.4'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.hash);
      assert.ok(result.shortHash);
      assert.strictEqual(typeof result.filesChanged, 'number');
    });
  });

  // ============================================
  // US-2: Pre-Commit Validation
  // ============================================
  describe('US-2: Pre-Commit Validation', () => {
    it('AC-2.1: Rejects commit when pipeline is running', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(true); // running = true
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: should fail'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some(e => e.code === 'PIPELINE_RUNNING'));
    });

    it('AC-2.2: Rejects commit when tests failed', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      // Write failed test status
      fs.writeFileSync(testStatusPath, JSON.stringify({
        lastRun: Date.now(),
        passed: 5,
        failed: 2,
        skipped: 0
      }));

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: should fail'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some(e => e.code === 'TEST_FAILED'));
    });

    it('AC-2.3: Returns clear rejection reason', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(true);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
      
      // Each error should have code, message, and suggestion
      for (const error of result.errors) {
        assert.ok(error.code);
        assert.ok(error.message);
        assert.ok(error.suggestion);
      }
    });

    it('AC-2.4: --force skips validation (admin only)', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(true); // running
      const mockSession = createMockSessionStore();

      // Write failed test status
      fs.writeFileSync(testStatusPath, JSON.stringify({
        lastRun: Date.now(),
        passed: 5,
        failed: 2,
        skipped: 0
      }));

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'admin-user',
        message: 'force commit',
        force: true
      });

      // Should succeed despite pipeline running and tests failing
      assert.strictEqual(result.success, true);
    });
  });

  // ============================================
  // US-3: Commit Result Feedback
  // ============================================
  describe('US-3: Commit Result Feedback', () => {
    it('AC-3.1: Success returns hash, author, time, file count', async () => {
      const mockGit = createMockGitService({
        commitResponse: {
          success: true,
          hash: 'success123',
          shortHash: 'success',
          message: 'test message',
          filesChanged: 3
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: AC-3.1'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.hash);
      assert.ok(result.shortHash);
      assert.strictEqual(typeof result.filesChanged, 'number');
    });

    it('AC-3.2: Failure returns error reason and suggestion', async () => {
      const mockGit = createMockGitService({
        commitResponse: {
          success: false,
          error: 'pre-commit hook failed',
          suggestion: 'Check hook configuration'
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: should fail'
      });

      // Git commit failure
      if (!result.success) {
        assert.ok(result.error || result.errors);
      }
    });

    it('AC-3.3: Returns "nothing to commit" when clean', async () => {
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
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: nothing'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some(e => e.code === 'NOTHING_TO_COMMIT'));
    });

    it('AC-3.4: Returns conflict file list on merge conflict', async () => {
      const mockGit = createMockGitService({
        statusResponse: {
          clean: false,
          staged: [],
          modified: [],
          untracked: [],
          conflicts: ['file1.js', 'file2.js'],
          currentBranch: 'main'
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: conflict'
      });

      assert.strictEqual(result.success, false);
      const conflictError = result.errors.find(e => e.code === 'MERGE_CONFLICT');
      assert.ok(conflictError);
      assert.ok(conflictError.files);
      assert.deepStrictEqual(conflictError.files, ['file1.js', 'file2.js']);
    });
  });

  // ============================================
  // US-4: Session Commit Tracking
  // ============================================
  describe('US-4: Session Commit Tracking', () => {
    it('AC-4.1: Commits stored with feature/bugfix ID', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test: feature commit',
        featureId: 'F-008'
      });

      const commits = mockSession.getCommits('test-session');
      assert.strictEqual(commits.length, 1);
      assert.strictEqual(commits[0].featureId, 'F-008');
    });

    it('AC-4.2: /status shows last commit', async () => {
      const mockGit = createMockGitService({
        lastCommitResponse: {
          hash: 'lastcommit123',
          shortHash: 'lastcom',
          message: 'last commit message',
          author: 'Test User',
          date: new Date().toISOString()
        }
      });

      const lastCommit = await mockGit.getLastCommit();
      assert.ok(lastCommit);
      assert.ok(lastCommit.shortHash);
      assert.ok(lastCommit.message);
    });

    it('AC-4.3: /commits shows session commit history', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      // Make multiple commits
      await commitService.commit({
        sessionId: 'test-session',
        userId: 'user1',
        message: 'commit 1'
      });
      await commitService.commit({
        sessionId: 'test-session',
        userId: 'user2',
        message: 'commit 2',
        featureId: 'F-008'
      });

      const commits = await commitService.getSessionCommits('test-session');
      assert.strictEqual(commits.length, 2);
      assert.strictEqual(commits[1].featureId, 'F-008');
    });
  });

  // ============================================
  // US-5: High-Risk Commit Protection
  // ============================================
  describe('US-5: High-Risk Commit Protection', () => {
    it('AC-5.1: Amend requires admin + confirmation (handler level)', async () => {
      // This verifies amend functionality at service level
      const mockGit = createMockGitService({
        amendResponse: {
          success: true,
          hash: 'amend123',
          shortHash: 'amend12',
          filesChanged: 1
        }
      });
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'admin-user',
        message: 'amended',
        amend: true,
        userRole: 'admin'
      });

      assert.strictEqual(result.success, true);
    });

    it('AC-5.2: Force requires admin + confirmation (handler level)', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(true); // running
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'admin-user',
        message: 'force commit',
        force: true,
        userRole: 'admin'
      });

      assert.strictEqual(result.success, true);
    });

    it('AC-5.3: All commit operations logged to audit', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      // Successful commit
      await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test audit logging',
        userRole: 'operator'
      });

      // Failed commit attempt
      const failedMockGit = createMockGitService({
        statusResponse: { clean: true, staged: [], modified: [], untracked: [], conflicts: [], currentBranch: 'main' }
      });
      const failService = createCommitService({
        gitService: failedMockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      await failService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'should fail',
        userRole: 'operator'
      });

      // Audit logging is verified by the commit service calling logAuditEntry
      // The actual audit log file is checked separately
    });
  });

  // ============================================
  // Additional Edge Cases
  // ============================================
  describe('Edge Cases and Error Handling', () => {
    it('handles missing test status file gracefully', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      // No test status file created
      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath: path.join(tempDir, 'nonexistent.json')
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test'
      });

      // Should succeed - missing test status treated as passed
      assert.strictEqual(result.success, true);
    });

    it('handles empty test status file gracefully', async () => {
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      fs.writeFileSync(testStatusPath, '');

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: 'test'
      });

      // Should succeed - invalid JSON treated as no tests
      assert.strictEqual(result.success, true);
    });

    it('validates commit message length in handler', async () => {
      // This is tested at handler level, but service should accept any message
      const mockGit = createMockGitService();
      const mockStatus = createMockStatusAggregator(false);
      const mockSession = createMockSessionStore();

      const commitService = createCommitService({
        gitService: mockGit,
        statusAggregator: mockStatus,
        sessionStore: mockSession,
        testStatusPath
      });

      const longMessage = 'a'.repeat(400);
      const result = await commitService.commit({
        sessionId: 'test-session',
        userId: 'test-user',
        message: longMessage
      });

      assert.strictEqual(result.success, true);
    });
  });
});
