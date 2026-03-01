/**
 * Tests for F-045: AI CLI Auto-Restart on Directory Change
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

describe('F-045 AI CLI Auto-Restart on Directory Change', () => {
  let handleCd;
  let sessionStore;
  let aiCliService;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const cdModule = await import(new URL(`file://${projectRoot}/src/bot/commands/handlers/cd.js`).href);
    handleCd = cdModule.handleCd;
    const sessionModule = await import(new URL(`file://${projectRoot}/src/services/session-store.js`).href);
    sessionStore = sessionModule.sessionStore;
    const aiCliModule = await import(new URL(`file://${projectRoot}/src/services/ai-cli-service.js`).href);
    aiCliService = aiCliModule;
  });

  afterEach(() => {
    // Clean up test sessions
    for (const key of ['f045-test-1', 'f045-test-2', 'f045-test-3']) {
      sessionStore.clearActiveProcess(key);
      sessionStore.setCwd(key, null);
    }
  });

  describe('restartAiCli', () => {
    test('should return error when no active process', async () => {
      const result = await aiCliService.restartAiCli('f045-test-1');
      assert.equal(result.ok, false);
      assert.ok(result.error.includes('没有正在执行的任务'));
    });

    test('should kill active process and return ok', async () => {
      // Spawn a real sleep process to act as the AI CLI
      const child = spawn('sleep', ['100'], { stdio: 'ignore' });

      // Simulate executeAiCli's close handler: clear process on exit
      child.on('close', () => {
        sessionStore.clearActiveProcess('f045-test-2');
      });

      sessionStore.setActiveProcess('f045-test-2', {
        pid: child.pid,
        startedAt: Date.now(),
        childProcess: child,
        interrupted: false,
        timedOut: false
      });

      assert.equal(aiCliService.isAiCliRunning('f045-test-2'), true);

      const result = await aiCliService.restartAiCli('f045-test-2');
      assert.equal(result.ok, true);
      assert.equal(result.oldPid, child.pid);
    });
  });

  describe('cd handler with active process', () => {
    test('should restart AI CLI when active process exists during /cd', async () => {
      // Spawn a real sleep process
      const child = spawn('sleep', ['100'], { stdio: 'ignore' });

      // Simulate executeAiCli's close handler
      child.on('close', () => {
        sessionStore.clearActiveProcess('f045-test-3');
      });

      sessionStore.setActiveProcess('f045-test-3', {
        pid: child.pid,
        startedAt: Date.now(),
        childProcess: child,
        interrupted: false,
        timedOut: false
      });

      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        sessionId: 'f045-test-3',
        args: ['/tmp']
      };

      await handleCd(handlerCtx);

      // Should have restart-related messages
      assert.ok(replies.length >= 2, `Expected >= 2 replies, got ${replies.length}: ${JSON.stringify(replies)}`);
      assert.ok(replies[0].includes('重启'), `First reply should mention restart: ${replies[0]}`);

      // Cwd should be updated
      const cwd = sessionStore.getCwd('f045-test-3');
      assert.equal(cwd, '/tmp');
    });

    test('should not restart when no active process during /cd', async () => {
      const replies = [];
      const handlerCtx = {
        reply: (msg) => replies.push(msg),
        sessionId: 'f045-test-1',
        args: ['/tmp']
      };

      await handleCd(handlerCtx);

      // Should just have the normal success message
      assert.equal(replies.length, 1);
      assert.ok(replies[0].includes('已切换'));
      assert.ok(!replies[0].includes('重启'));

      const cwd = sessionStore.getCwd('f045-test-1');
      assert.equal(cwd, '/tmp');
    });
  });

  describe('isAiCliRunning', () => {
    test('should return false when no active process', () => {
      assert.equal(aiCliService.isAiCliRunning('f045-test-1'), false);
    });

    test('should return true when active process exists', () => {
      const child = spawn('sleep', ['100'], { stdio: 'ignore' });
      sessionStore.setActiveProcess('f045-test-1', {
        pid: child.pid,
        startedAt: Date.now(),
        childProcess: child,
        interrupted: false,
        timedOut: false
      });

      assert.equal(aiCliService.isAiCliRunning('f045-test-1'), true);

      // Cleanup
      child.kill('SIGTERM');
      sessionStore.clearActiveProcess('f045-test-1');
    });
  });
});
