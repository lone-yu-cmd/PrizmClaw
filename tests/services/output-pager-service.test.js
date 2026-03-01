/**
 * Tests for F-009 output pager service
 * T-3.1: Create output-pager-service.js
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-009 Output Pager Service', () => {
  let outputPagerService;

  beforeEach(async () => {
    const module = await import('../../src/services/output-pager-service.js');
    outputPagerService = module;
  });

  describe('paginateOutput', () => {
    test('should return single page for short text', async () => {
      const { paginateOutput } = outputPagerService;
      const text = 'short text';
      const pages = paginateOutput(text, 4000);
      assert.deepEqual(pages, [text]);
    });

    test('should split text at chunk size boundary', async () => {
      const { paginateOutput } = outputPagerService;
      const chunkSize = 10;
      const text = '123456789012345678901234567890'; // 30 chars
      const pages = paginateOutput(text, chunkSize);
      assert.equal(pages.length, 3);
      assert.equal(pages[0], '1234567890');
      assert.equal(pages[1], '1234567890');
      assert.equal(pages[2], '1234567890');
    });

    test('should handle empty text', async () => {
      const { paginateOutput } = outputPagerService;
      const pages = paginateOutput('', 4000);
      assert.deepEqual(pages, ['']);
    });

    test('should handle text exactly at chunk boundary', async () => {
      const { paginateOutput } = outputPagerService;
      const chunkSize = 10;
      const text = '1234567890'; // exactly 10 chars
      const pages = paginateOutput(text, chunkSize);
      assert.equal(pages.length, 1);
      assert.equal(pages[0], '1234567890');
    });

    test('should default to 4000 chunk size', async () => {
      const { paginateOutput } = outputPagerService;
      const text = 'a'.repeat(8000);
      const pages = paginateOutput(text);
      assert.equal(pages.length, 2);
      assert.equal(pages[0].length, 4000);
      assert.equal(pages[1].length, 4000);
    });
  });

  describe('storeOutputPages', () => {
    test('should store pages in session store', async () => {
      const { storeOutputPages } = outputPagerService;
      const pages = ['page 1', 'page 2'];
      storeOutputPages('test-session-1', pages);

      const { sessionStore } = await import('../../src/services/session-store.js');
      const stored = sessionStore.getOutputPages('test-session-1');
      assert.deepEqual(stored, pages);
    });

    test('should overwrite existing pages', async () => {
      const { storeOutputPages } = outputPagerService;
      const { sessionStore } = await import('../../src/services/session-store.js');

      storeOutputPages('test-session-2', ['old page']);
      storeOutputPages('test-session-2', ['new page 1', 'new page 2']);

      const stored = sessionStore.getOutputPages('test-session-2');
      assert.deepEqual(stored, ['new page 1', 'new page 2']);
    });
  });

  describe('getNextPage', () => {
    test('should return first page and shift', async () => {
      const { storeOutputPages, getNextPage } = outputPagerService;
      const pages = ['page 1', 'page 2', 'page 3'];
      storeOutputPages('test-session-3', pages);

      const page1 = getNextPage('test-session-3');
      assert.equal(page1, 'page 1');

      const page2 = getNextPage('test-session-3');
      assert.equal(page2, 'page 2');

      const page3 = getNextPage('test-session-3');
      assert.equal(page3, 'page 3');
    });

    test('should return null when no pages left', async () => {
      const { storeOutputPages, getNextPage } = outputPagerService;
      storeOutputPages('test-session-4', ['single page']);

      getNextPage('test-session-4');
      const result = getNextPage('test-session-4');
      assert.equal(result, null);
    });

    test('should return null when session has no pages', async () => {
      const { getNextPage } = outputPagerService;
      const result = getNextPage('non-existent-session');
      assert.equal(result, null);
    });
  });

  describe('clearPages', () => {
    test('should clear pages for session', async () => {
      const { storeOutputPages, clearPages } = outputPagerService;
      const { sessionStore } = await import('../../src/services/session-store.js');

      storeOutputPages('test-session-5', ['page 1', 'page 2']);
      clearPages('test-session-5');

      const result = sessionStore.getOutputPages('test-session-5');
      assert.equal(result, null);
    });
  });

  describe('hasMorePages', () => {
    test('should return true when pages exist', async () => {
      const { storeOutputPages, hasMorePages } = outputPagerService;
      storeOutputPages('test-session-6', ['page 1', 'page 2']);
      assert.equal(hasMorePages('test-session-6'), true);
    });

    test('should return false when no pages', async () => {
      const { hasMorePages } = outputPagerService;
      assert.equal(hasMorePages('non-existent-session'), false);
    });

    test('should return false after all pages consumed', async () => {
      const { storeOutputPages, getNextPage, hasMorePages } = outputPagerService;
      storeOutputPages('test-session-7', ['single page']);
      getNextPage('test-session-7');
      assert.equal(hasMorePages('test-session-7'), false);
    });
  });
});
