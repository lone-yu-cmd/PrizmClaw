/**
 * Git Service Unit Tests
 *
 * F-008: Commit Workflow Integration
 * Tests for GitService module
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createGitService } from '../../src/services/git-service.js';

describe('GitService', () => {
  let gitService;
  let mockGit;

  beforeEach(() => {
    // Create mock git instance
    mockGit = {
      status: async () => ({
        isClean: () => true,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: [],
        ahead: 0,
        behind: 0,
        current: 'main'
      }),
      commit: async () => ({ commit: 'abc123def456', summary: { changes: 2 } }),
      log: async () => ({ latest: { hash: 'abc123', message: 'test', author_name: 'user', date: new Date().toISOString() }, all: [] }),
      diff: async () => ''
    };

    gitService = createGitService({ git: mockGit });
  });

  describe('getStatus()', () => {
    it('should return GitStatus object with correct structure', async () => {
      const result = await gitService.getStatus();

      assert.ok(result);
      assert.ok(typeof result.clean === 'boolean');
      assert.ok(Array.isArray(result.staged));
      assert.ok(Array.isArray(result.modified));
      assert.ok(Array.isArray(result.untracked));
      assert.ok(Array.isArray(result.conflicts));
      assert.ok(typeof result.ahead === 'number');
      assert.ok(typeof result.behind === 'number');
      assert.ok(typeof result.currentBranch === 'string');
    });

    it('should return clean: true when working directory is clean', async () => {
      mockGit.status = async () => ({
        isClean: () => true,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: [],
        ahead: 0,
        behind: 0,
        current: 'main'
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getStatus();
      assert.strictEqual(result.clean, true);
    });

    it('should return clean: false when there are changes', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: ['file1.js'],
        modified: ['file2.js'],
        not_added: ['file3.js'],
        conflicted: [],
        ahead: 0,
        behind: 0,
        current: 'feature-branch'
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getStatus();
      assert.strictEqual(result.clean, false);
      assert.deepStrictEqual(result.staged, ['file1.js']);
      assert.deepStrictEqual(result.modified, ['file2.js']);
      assert.deepStrictEqual(result.untracked, ['file3.js']);
      assert.strictEqual(result.currentBranch, 'feature-branch');
    });

    it('should detect merge conflicts', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: ['conflicted-file.js'],
        ahead: 0,
        behind: 0,
        current: 'main'
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getStatus();
      assert.deepStrictEqual(result.conflicts, ['conflicted-file.js']);
    });

    it('should return ahead/behind counts', async () => {
      mockGit.status = async () => ({
        isClean: () => true,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: [],
        ahead: 2,
        behind: 1,
        current: 'main'
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getStatus();
      assert.strictEqual(result.ahead, 2);
      assert.strictEqual(result.behind, 1);
    });
  });

  describe('isClean()', () => {
    it('should return true when working directory is clean', async () => {
      mockGit.status = async () => ({ isClean: () => true });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.isClean();
      assert.strictEqual(result, true);
    });

    it('should return false when there are changes', async () => {
      mockGit.status = async () => ({ isClean: () => false });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.isClean();
      assert.strictEqual(result, false);
    });
  });

  describe('getChangedFiles()', () => {
    it('should return array of changed file paths', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: ['staged.js'],
        modified: ['modified.js'],
        not_added: ['untracked.js'],
        conflicted: []
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getChangedFiles();
      assert.ok(result.includes('staged.js'));
      assert.ok(result.includes('modified.js'));
      assert.ok(result.includes('untracked.js'));
    });

    it('should return empty array when clean', async () => {
      mockGit.status = async () => ({
        isClean: () => true,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: []
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getChangedFiles();
      assert.deepStrictEqual(result, []);
    });
  });

  describe('commit()', () => {
    it('should return CommitResult with hash on success', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: ['file.js'],
        modified: [],
        not_added: [],
        conflicted: []
      });
      mockGit.commit = async () => ({
        commit: 'abc123def456789',
        summary: { changes: 3 }
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.commit('test message');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.hash, 'abc123def456789');
      assert.strictEqual(result.shortHash, 'abc123d');
      assert.strictEqual(result.filesChanged, 3);
    });

    it('should return error when commit fails', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: ['file.js'],
        modified: [],
        not_added: [],
        conflicted: []
      });
      mockGit.commit = async () => {
        throw new Error('Nothing to commit');
      };
      gitService = createGitService({ git: mockGit });

      const result = await gitService.commit('test message');

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should return error when no commit hash returned', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: ['file.js'],
        modified: [],
        not_added: [],
        conflicted: []
      });
      mockGit.commit = async () => ({ commit: null });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.commit('test message');

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should return error when nothing to commit', async () => {
      mockGit.status = async () => ({
        isClean: () => true,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: []
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.commit('test message');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.code, 'NOTHING_TO_COMMIT');
    });

    it('should return error when merge conflicts exist', async () => {
      mockGit.status = async () => ({
        isClean: () => false,
        staged: [],
        modified: [],
        not_added: [],
        conflicted: ['conflicted.js']
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.commit('test message');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.code, 'MERGE_CONFLICT');
    });
  });

  describe('amendCommit()', () => {
    it('should amend last commit successfully', async () => {
      mockGit.commit = async (msg, opts) => {
        // Implementation passes ['--amend', '--no-edit']
        if (Array.isArray(opts) && opts.includes('--amend')) {
          return { commit: 'amended123', summary: { changes: 1 } };
        }
        return { commit: 'new123' };
      };
      mockGit.log = async () => ({
        latest: { hash: 'previous123', message: 'prev', author_name: 'user' }
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.amendCommit('amended message');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.hash, 'amended123');
    });

    it('should return error when amend fails', async () => {
      mockGit.commit = async () => {
        throw new Error('Cannot amend');
      };
      gitService = createGitService({ git: mockGit });

      const result = await gitService.amendCommit('amended message');

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('getLastCommit()', () => {
    it('should return last commit info', async () => {
      mockGit.log = async () => ({
        latest: {
          hash: 'abc123def456',
          message: 'Last commit message',
          author_name: 'Test Author',
          date: '2024-01-15T10:30:00Z'
        }
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getLastCommit();

      assert.strictEqual(result.hash, 'abc123def456');
      assert.strictEqual(result.shortHash, 'abc123d');
      assert.strictEqual(result.message, 'Last commit message');
      assert.strictEqual(result.author, 'Test Author');
      assert.ok(result.date);
    });

    it('should handle empty log', async () => {
      mockGit.log = async () => ({ latest: null });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getLastCommit();

      assert.strictEqual(result, null);
    });
  });

  describe('getCommitLog()', () => {
    it('should return array of commit info', async () => {
      mockGit.log = async (opts) => ({
        all: [
          { hash: 'commit1', message: 'msg1', author_name: 'author1', date: '2024-01-01' },
          { hash: 'commit2', message: 'msg2', author_name: 'author2', date: '2024-01-02' }
        ]
      });
      gitService = createGitService({ git: mockGit });

      const result = await gitService.getCommitLog(2);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].hash, 'commit1');
      assert.strictEqual(result[1].message, 'msg2');
    });

    it('should default to 10 commits', async () => {
      let capturedOpts;
      mockGit.log = async (opts) => {
        capturedOpts = opts;
        return { all: [] };
      };
      gitService = createGitService({ git: mockGit });

      await gitService.getCommitLog();

      // Implementation passes ['-10'] not { '-n': 10 }
      assert.ok(capturedOpts);
      assert.ok(capturedOpts.includes('-10'));
    });
  });

  describe('getShortHash()', () => {
    it('should return 7-character short hash', () => {
      const result = gitService.getShortHash('a1b2c3d4e5f6g7h8');
      assert.strictEqual(result, 'a1b2c3d');
    });

    it('should return empty string for null input', () => {
      const result = gitService.getShortHash(null);
      assert.strictEqual(result, '');
    });

    it('should handle short hashes', () => {
      const result = gitService.getShortHash('abc');
      assert.strictEqual(result, 'abc');
    });
  });
});
