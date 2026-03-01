/**
 * Tests for F-020 Output History Service
 * src/services/output-history-service.js
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createOutputHistoryService } from '../../src/services/output-history-service.js';

describe('output-history-service', () => {
  let service;

  beforeEach(() => {
    service = createOutputHistoryService();
  });

  describe('createOutputHistoryService', () => {
    test('should return a service with required methods', () => {
      assert.ok(service);
      assert.equal(typeof service.addOutput, 'function');
      assert.equal(typeof service.getHistory, 'function');
      assert.equal(typeof service.clearHistory, 'function');
    });

    test('should use default maxEntries of 10', () => {
      const svc = createOutputHistoryService();
      for (let i = 0; i < 15; i++) {
        svc.addOutput('session1', `prompt ${i}`, `output ${i}`);
      }
      const history = svc.getHistory('session1', 20);
      assert.equal(history.length, 10, 'Should keep only last 10 entries by default');
    });

    test('should respect custom maxEntries', () => {
      const svc = createOutputHistoryService(5);
      for (let i = 0; i < 8; i++) {
        svc.addOutput('session1', `prompt ${i}`, `output ${i}`);
      }
      const history = svc.getHistory('session1', 10);
      assert.equal(history.length, 5, 'Should keep only last 5 entries');
    });
  });

  describe('addOutput', () => {
    test('should store output entry with required fields', () => {
      service.addOutput('session1', 'ls -la', 'total 123\ndrwxr-xr-x ...');
      const history = service.getHistory('session1', 1);
      assert.equal(history.length, 1);

      const entry = history[0];
      assert.equal(entry.prompt, 'ls -la');
      assert.equal(entry.output, 'total 123\ndrwxr-xr-x ...');
      assert.ok(typeof entry.timestamp === 'number');
      assert.ok(typeof entry.index === 'number');
    });

    test('should assign incrementing index to entries', () => {
      service.addOutput('session1', 'cmd1', 'output1');
      service.addOutput('session1', 'cmd2', 'output2');
      service.addOutput('session1', 'cmd3', 'output3');

      const history = service.getHistory('session1', 10);
      assert.equal(history.length, 3);
      // Indices should be distinct and ascending
      assert.ok(history[0].index < history[1].index);
      assert.ok(history[1].index < history[2].index);
    });

    test('should store entries per session key', () => {
      service.addOutput('session1', 'prompt-a', 'output-a');
      service.addOutput('session2', 'prompt-b', 'output-b');

      const hist1 = service.getHistory('session1', 10);
      const hist2 = service.getHistory('session2', 10);

      assert.equal(hist1.length, 1);
      assert.equal(hist2.length, 1);
      assert.equal(hist1[0].prompt, 'prompt-a');
      assert.equal(hist2[0].prompt, 'prompt-b');
    });

    test('should act as ring buffer — oldest entries dropped when full', () => {
      const svc = createOutputHistoryService(3);
      svc.addOutput('s', 'p0', 'o0');
      svc.addOutput('s', 'p1', 'o1');
      svc.addOutput('s', 'p2', 'o2');
      svc.addOutput('s', 'p3', 'o3'); // This should evict p0

      const history = svc.getHistory('s', 10);
      assert.equal(history.length, 3);
      // Oldest (p0) should be gone
      const prompts = history.map((e) => e.prompt);
      assert.ok(!prompts.includes('p0'), 'Oldest entry should be evicted');
      assert.ok(prompts.includes('p1'));
      assert.ok(prompts.includes('p2'));
      assert.ok(prompts.includes('p3'));
    });

    test('should record timestamp as a number close to Date.now()', () => {
      const before = Date.now();
      service.addOutput('s', 'p', 'o');
      const after = Date.now();

      const history = service.getHistory('s', 1);
      assert.ok(history[0].timestamp >= before);
      assert.ok(history[0].timestamp <= after);
    });
  });

  describe('getHistory', () => {
    test('should return empty array for unknown session', () => {
      const result = service.getHistory('unknown-session', 5);
      assert.deepEqual(result, []);
    });

    test('should return last N entries ordered oldest to newest', () => {
      service.addOutput('s', 'p0', 'o0');
      service.addOutput('s', 'p1', 'o1');
      service.addOutput('s', 'p2', 'o2');
      service.addOutput('s', 'p3', 'o3');
      service.addOutput('s', 'p4', 'o4');

      const history = service.getHistory('s', 3);
      assert.equal(history.length, 3);
      // Should get the last 3 (most recent)
      const prompts = history.map((e) => e.prompt);
      assert.ok(prompts.includes('p4'));
      assert.ok(prompts.includes('p3'));
      assert.ok(prompts.includes('p2'));
      assert.ok(!prompts.includes('p0'));
      assert.ok(!prompts.includes('p1'));
    });

    test('should return all entries when count exceeds stored count', () => {
      service.addOutput('s', 'p0', 'o0');
      service.addOutput('s', 'p1', 'o1');

      const history = service.getHistory('s', 100);
      assert.equal(history.length, 2);
    });

    test('should return entries in chronological order (oldest first)', () => {
      service.addOutput('s', 'first', 'o1');
      service.addOutput('s', 'second', 'o2');
      service.addOutput('s', 'third', 'o3');

      const history = service.getHistory('s', 3);
      assert.equal(history[0].prompt, 'first');
      assert.equal(history[1].prompt, 'second');
      assert.equal(history[2].prompt, 'third');
    });

    test('count=0 returns empty array', () => {
      service.addOutput('s', 'p', 'o');
      const history = service.getHistory('s', 0);
      assert.deepEqual(history, []);
    });
  });

  describe('clearHistory', () => {
    test('should clear all entries for a session', () => {
      service.addOutput('s', 'p0', 'o0');
      service.addOutput('s', 'p1', 'o1');
      service.clearHistory('s');

      const history = service.getHistory('s', 10);
      assert.deepEqual(history, []);
    });

    test('should not affect other sessions', () => {
      service.addOutput('s1', 'p', 'o');
      service.addOutput('s2', 'p', 'o');
      service.clearHistory('s1');

      assert.deepEqual(service.getHistory('s1', 10), []);
      assert.equal(service.getHistory('s2', 10).length, 1);
    });

    test('should be safe to call on unknown session', () => {
      assert.doesNotThrow(() => service.clearHistory('nonexistent'));
    });
  });
});
