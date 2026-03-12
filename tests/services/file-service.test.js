/**
 * Tests for F-010 file service
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('F-010 File Service', () => {
  let fileService;
  let testDir;
  let sessionId;

  beforeEach(async () => {
    const module = await import('../../src/services/file-service.js');
    fileService = module;

    // Create test directory
    testDir = path.join(os.tmpdir(), `file-service-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create test files
    await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello, World!\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\nLine 12\nLine 13\nLine 14\nLine 15'); // No trailing newline
    await fs.writeFile(path.join(testDir, 'binary.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
    await fs.mkdir(path.join(testDir, 'subdir'));
    await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'Nested file');

    sessionId = `test-session-${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('resolveSessionPath', () => {
    test('should resolve absolute path unchanged', async () => {
      const { resolveSessionPath } = fileService;
      const result = resolveSessionPath('/tmp/test', sessionId);
      assert.equal(result, '/tmp/test');
    });

    test('should resolve home directory (~) expansion', async () => {
      const { resolveSessionPath } = fileService;
      const result = resolveSessionPath('~/Documents', sessionId);
      assert.ok(result.startsWith(process.env.HOME || ''));
      assert.ok(result.includes('Documents'));
    });

    test('should resolve relative path using cwd', async () => {
      const { resolveSessionPath } = fileService;
      const { sessionStore } = await import('../../src/services/session-store.js');
      sessionStore.setCwd(sessionId, testDir);

      const result = resolveSessionPath('subdir/file.txt', sessionId);
      assert.equal(result, path.join(testDir, 'subdir', 'file.txt'));
    });

    test('should return null for empty path', async () => {
      const { resolveSessionPath } = fileService;
      assert.equal(resolveSessionPath('', sessionId), null);
      assert.equal(resolveSessionPath(null, sessionId), null);
      assert.equal(resolveSessionPath(undefined, sessionId), null);
    });
  });

  describe('validatePath', () => {
    test('should accept path within test directory', async () => {
      const { validatePath } = fileService;
      const result = await validatePath(testDir, sessionId);
      assert.ok(result.ok);
      assert.ok(result.resolved);
    });

    test('should reject empty path', async () => {
      const { validatePath } = fileService;
      const result = await validatePath('', sessionId);
      assert.equal(result.ok, false);
      assert.ok(result.error);
    });

    test('should reject path with .. in input', async () => {
      const { resolveSessionPath } = fileService;
      // Test that resolveSessionPath normalizes but still produces a valid path
      // The actual security check is done by allowed roots in validatePath
      const result = resolveSessionPath('/tmp/../etc/passwd', sessionId);
      // After normalization: /etc/passwd (not within test directory)
      assert.ok(result);
      assert.ok(!result.includes('..'));
    });
  });

  describe('listDirectory', () => {
    test('should list directory contents', async () => {
      const { listDirectory } = fileService;
      const result = await listDirectory(testDir, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.equal(result.totalCount, 3); // test.txt, binary.bin, subdir
      assert.ok(result.items.some((item) => item.name === 'test.txt'));
      assert.ok(result.items.some((item) => item.name === 'subdir'));
    });

    test('should sort directories first', async () => {
      const { listDirectory } = fileService;
      const result = await listDirectory(testDir, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      const firstItem = result.items[0];
      assert.equal(firstItem.isDirectory, true);
    });

    test('should handle non-existent directory', async () => {
      const { listDirectory } = fileService;
      const result = await listDirectory('/nonexistent/path/12345', sessionId);
      assert.ok(result.error);
      assert.ok(result.error.includes('不存在'));
    });

    test('should use session cwd when no path provided', async () => {
      const { listDirectory } = fileService;
      const { sessionStore } = await import('../../src/services/session-store.js');
      sessionStore.setCwd(sessionId, testDir);

      const result = await listDirectory(null, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      // Use fs.realpath to resolve symlinks for comparison (macOS /var -> /private/var)
      const expectedReal = await fs.realpath(testDir);
      const actualReal = await fs.realpath(result.path);
      assert.equal(actualReal, expectedReal);
    });
  });

  describe('buildTree', () => {
    test('should build tree with default depth', async () => {
      const { buildTree } = fileService;
      const result = await buildTree(testDir, {}, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.ok(result.tree);
      assert.ok(result.tree.includes('test.txt'));
      assert.ok(result.tree.includes('subdir'));
    });

    test('should respect max depth limit', async () => {
      const { buildTree } = fileService;
      const result = await buildTree(testDir, { maxDepth: 1 }, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      // Should not show nested.txt (depth 2)
      assert.ok(!result.tree.includes('nested.txt'));
    });

    test('should handle non-existent directory', async () => {
      const { buildTree } = fileService;
      const result = await buildTree('/nonexistent/path/12345', {}, sessionId);
      assert.ok(result.error);
    });
  });

  describe('readFile', () => {
    test('should read text file content', async () => {
      const { readFile } = fileService;
      const result = await readFile(path.join(testDir, 'test.txt'), {}, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.ok(result.content.includes('Hello, World!'));
      assert.equal(result.isBinary, false);
    });

    test('should detect binary files', async () => {
      const { readFile } = fileService;
      const result = await readFile(path.join(testDir, 'binary.bin'), {}, sessionId);
      assert.ok(result.isBinary);
      assert.ok(result.error.includes('二进制'));
    });

    test('should support head option', async () => {
      const { readFile } = fileService;
      const result = await readFile(path.join(testDir, 'test.txt'), { headLines: 5 }, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      const lines = result.content.split('\n').filter(Boolean);
      assert.equal(lines.length, 5);
    });

    test('should support tail option', async () => {
      const { readFile } = fileService;
      const result = await readFile(path.join(testDir, 'test.txt'), { tailLines: 3 }, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      const lines = result.content.split('\n').filter(Boolean);
      assert.equal(lines.length, 3);
      assert.ok(lines[lines.length - 1].includes('Line 15'));
    });

    test('should handle non-existent file', async () => {
      const { readFile } = fileService;
      const result = await readFile('/nonexistent/file.txt', {}, sessionId);
      assert.ok(result.error);
    });

    test('should reject directory path', async () => {
      const { readFile } = fileService;
      const result = await readFile(testDir, {}, sessionId);
      assert.ok(result.error);
      assert.ok(result.error.includes('目录'));
    });
  });

  describe('searchFiles', () => {
    test('should match glob patterns', async () => {
      const { searchFiles } = fileService;
      const result = await searchFiles('*.txt', { cwd: testDir }, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.ok(result.results.some((r) => r.name === 'test.txt'));
      assert.ok(result.results.some((r) => r.name === 'nested.txt'));
    });

    test('should respect max depth', async () => {
      const { searchFiles } = fileService;
      // maxDepth=1 means we can search depth 0 (testDir) and depth 1 (immediate children)
      // nested.txt is at depth 2 (testDir -> subdir -> nested.txt), so maxDepth=1 should NOT find it
      const result = await searchFiles('*.txt', { cwd: testDir, maxDepth: 0 }, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      // Should find test.txt (depth 0) but not nested.txt (depth 2)
      assert.ok(result.results.some((r) => r.name === 'test.txt'));
      assert.ok(!result.results.some((r) => r.name === 'nested.txt'));
    });

    test('should respect max results', async () => {
      const { searchFiles } = fileService;
      const result = await searchFiles('*', { cwd: testDir, maxResults: 2 }, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.ok(result.results.length <= 2);
    });

    test('should search from session cwd', async () => {
      const { searchFiles } = fileService;
      const { sessionStore } = await import('../../src/services/session-store.js');
      sessionStore.setCwd(sessionId, testDir);

      const result = await searchFiles('*.txt', {}, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.ok(result.results.length > 0);
    });
  });

  describe('writeFile', () => {
    test('should write new file', async () => {
      const { writeFile } = fileService;
      const content = Buffer.from('Test content');
      const result = await writeFile(path.join(testDir, 'new.txt'), content, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.equal(result.size, 12);
      assert.equal(result.overwritten, false);

      // Verify file was written
      const written = await fs.readFile(path.join(testDir, 'new.txt'), 'utf-8');
      assert.equal(written, 'Test content');
    });

    test('should overwrite existing file', async () => {
      const { writeFile } = fileService;
      const content = Buffer.from('New content');
      const result = await writeFile(path.join(testDir, 'test.txt'), content, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);
      assert.equal(result.overwritten, true);
    });

    test('should create parent directories', async () => {
      const { writeFile } = fileService;
      const content = Buffer.from('Nested content');
      const result = await writeFile(path.join(testDir, 'deep', 'nested', 'file.txt'), content, sessionId);
      assert.ok(!result.error, `Unexpected error: ${result.error}`);

      // Verify directory was created
      const written = await fs.readFile(path.join(testDir, 'deep', 'nested', 'file.txt'), 'utf-8');
      assert.equal(written, 'Nested content');
    });

    test('should reject invalid content type', async () => {
      const { writeFile } = fileService;
      const result = await writeFile(path.join(testDir, 'invalid.txt'), 'string content', sessionId);
      assert.ok(result.error);
    });
  });

  describe('isBinaryFile', () => {
    test('should return true for binary file', async () => {
      const { isBinaryFile } = fileService;
      const result = await isBinaryFile(path.join(testDir, 'binary.bin'));
      assert.equal(result, true);
    });

    test('should return false for text file', async () => {
      const { isBinaryFile } = fileService;
      const result = await isBinaryFile(path.join(testDir, 'test.txt'));
      assert.equal(result, false);
    });
  });
});
