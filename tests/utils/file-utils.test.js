/**
 * Tests for F-010 file utilities
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-010 File Utilities', () => {
  let fileUtils;

  beforeEach(async () => {
    const module = await import('../../src/utils/file-utils.js');
    fileUtils = module;
  });

  describe('formatFileSize', () => {
    test('should format bytes correctly', async () => {
      const { formatFileSize } = fileUtils;
      assert.equal(formatFileSize(0), '0 B');
      assert.equal(formatFileSize(1), '1 B');
      assert.equal(formatFileSize(512), '512 B');
      assert.equal(formatFileSize(1023), '1023 B');
    });

    test('should format kilobytes correctly', async () => {
      const { formatFileSize } = fileUtils;
      assert.equal(formatFileSize(1024), '1.0 KB');
      assert.equal(formatFileSize(1536), '1.5 KB');
      assert.equal(formatFileSize(10240), '10 KB');
    });

    test('should format megabytes correctly', async () => {
      const { formatFileSize } = fileUtils;
      assert.equal(formatFileSize(1048576), '1.0 MB');
      assert.equal(formatFileSize(1572864), '1.5 MB');
      assert.equal(formatFileSize(10485760), '10 MB');
    });

    test('should handle negative and invalid inputs', async () => {
      const { formatFileSize } = fileUtils;
      assert.equal(formatFileSize(-1), '0 B');
      assert.equal(formatFileSize(null), '0 B');
      assert.equal(formatFileSize(undefined), '0 B');
      assert.equal(formatFileSize('invalid'), '0 B');
    });
  });

  describe('formatDate', () => {
    test('should format today date with time', async () => {
      const { formatDate } = fileUtils;
      const now = new Date();
      const result = formatDate(now);
      // Should contain hour:minute format
      assert.ok(/\d{1,2}:\d{2}/.test(result) || result.includes(':'));
    });

    test('should format older dates with date components', async () => {
      const { formatDate } = fileUtils;
      const oldDate = new Date('2020-01-15T12:00:00Z');
      const result = formatDate(oldDate);
      assert.ok(result.includes('2020') || result.includes('2020年') || result.includes('1月') || result.includes('Jan'));
    });

    test('should handle invalid dates', async () => {
      const { formatDate } = fileUtils;
      assert.equal(formatDate(null), '-');
      assert.equal(formatDate(undefined), '-');
      assert.equal(formatDate('invalid'), '-');
    });
  });

  describe('formatFileInfo', () => {
    test('should format directory info', async () => {
      const { formatFileInfo } = fileUtils;
      const result = formatFileInfo({
        name: 'testdir',
        isDirectory: true,
        size: 0,
        modifiedTime: new Date()
      });
      assert.ok(result.includes('📁'));
      assert.ok(result.includes('testdir'));
    });

    test('should format file info with size', async () => {
      const { formatFileInfo } = fileUtils;
      const result = formatFileInfo({
        name: 'test.txt',
        isDirectory: false,
        size: 1024,
        modifiedTime: new Date()
      });
      assert.ok(result.includes('📄'));
      assert.ok(result.includes('test.txt'));
      assert.ok(result.includes('KB') || result.includes('1024'));
    });

    test('should handle missing info gracefully', async () => {
      const { formatFileInfo } = fileUtils;
      assert.equal(formatFileInfo(null), '');
      assert.equal(formatFileInfo({}), '');
      assert.equal(formatFileInfo({ name: 'test' }), '');
    });
  });

  describe('isBinaryContent', () => {
    test('should detect binary content with null bytes', async () => {
      const { isBinaryContent } = fileUtils;
      const binaryBuffer = Buffer.from([0x01, 0x02, 0x00, 0x04, 0x05]);
      assert.equal(isBinaryContent(binaryBuffer), true);
    });

    test('should return false for text content', async () => {
      const { isBinaryContent } = fileUtils;
      const textBuffer = Buffer.from('Hello, World!');
      assert.equal(isBinaryContent(textBuffer), false);
    });

    test('should handle empty buffer', async () => {
      const { isBinaryContent } = fileUtils;
      assert.equal(isBinaryContent(Buffer.alloc(0)), false);
    });

    test('should handle invalid inputs', async () => {
      const { isBinaryContent } = fileUtils;
      assert.equal(isBinaryContent(null), false);
      assert.equal(isBinaryContent(undefined), false);
      assert.equal(isBinaryContent('not a buffer'), false);
    });

    test('should respect sample size parameter', async () => {
      const { isBinaryContent } = fileUtils;
      // Create buffer filled with non-zero values, then set null byte at position 100
      const buffer = Buffer.alloc(200, 0x41); // fill with 'A'
      buffer[100] = 0;
      // With sample size of 50, should not detect binary
      assert.equal(isBinaryContent(buffer, 50), false);
      // With sample size of 150, should detect binary
      assert.equal(isBinaryContent(buffer, 150), true);
    });
  });

  describe('getFileExtension', () => {
    test('should extract extension correctly', async () => {
      const { getFileExtension } = fileUtils;
      assert.equal(getFileExtension('test.txt'), 'txt');
      assert.equal(getFileExtension('document.PDF'), 'pdf');
      assert.equal(getFileExtension('archive.tar.gz'), 'gz');
    });

    test('should handle files without extension', async () => {
      const { getFileExtension } = fileUtils;
      assert.equal(getFileExtension('README'), '');
      assert.equal(getFileExtension('.gitignore'), '');
    });

    test('should handle invalid inputs', async () => {
      const { getFileExtension } = fileUtils;
      assert.equal(getFileExtension(null), '');
      assert.equal(getFileExtension(undefined), '');
      assert.equal(getFileExtension(''), '');
    });
  });

  describe('isImageExtension', () => {
    test('should identify image extensions', async () => {
      const { isImageExtension } = fileUtils;
      assert.equal(isImageExtension('png'), true);
      assert.equal(isImageExtension('jpg'), true);
      assert.equal(isImageExtension('jpeg'), true);
      assert.equal(isImageExtension('gif'), true);
      assert.equal(isImageExtension('webp'), true);
    });

    test('should reject non-image extensions', async () => {
      const { isImageExtension } = fileUtils;
      assert.equal(isImageExtension('txt'), false);
      assert.equal(isImageExtension('pdf'), false);
      assert.equal(isImageExtension('doc'), false);
    });
  });
});
