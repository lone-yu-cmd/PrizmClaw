import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('F-012 System Monitor Integration', () => {
  let tempDir;
  let SystemMonitorService;
  let AlertManagerService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'f012-integration-test-'));

    const monitorModule = await import('../../src/services/system-monitor-service.js');
    const alertModule = await import('../../src/services/alert-manager-service.js');

    SystemMonitorService = monitorModule.SystemMonitorService;
    AlertManagerService = alertModule.AlertManagerService;
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Full workflow', () => {
    test('should get system info and check against alert rules', async () => {
      const monitor = new SystemMonitorService();
      const alertManager = new AlertManagerService({ dataDir: tempDir });

      // Get system info
      const info = await monitor.getSystemInfo();
      assert.ok(info.cpu, 'Should have CPU info');
      assert.ok(info.memory, 'Should have memory info');
      assert.ok(info.disk, 'Should have disk info');

      // Add an alert rule
      const rule = alertManager.addRule({
        metric: 'cpu',
        operator: '>',
        threshold: 0, // Low threshold to ensure trigger
        enabled: true
      });

      assert.ok(rule.id, 'Should have rule ID');

      // Check thresholds
      const alerts = alertManager.checkThresholds(info);

      // CPU usage > 0 should trigger
      assert.ok(alerts.length >= 1, 'Should have at least one alert');

      // Save and reload rules
      await alertManager.saveRules();
      await alertManager.loadRules();

      const rules = alertManager.listRules();
      assert.equal(rules.length, 1, 'Should have one rule after reload');
    });

    test('should persist rules across service instances', async () => {
      // Create first instance and add a rule
      const alertManager1 = new AlertManagerService({
        dataDir: tempDir,
        rulesFile: 'test-rules.json'
      });

      const rule = alertManager1.addRule({
        metric: 'memory',
        operator: '>=',
        threshold: 50,
        enabled: true
      });

      await alertManager1.saveRules();

      // Create second instance and load rules
      const alertManager2 = new AlertManagerService({
        dataDir: tempDir,
        rulesFile: 'test-rules.json'
      });

      await alertManager2.loadRules();

      const rules = alertManager2.listRules();
      assert.equal(rules.length, 1, 'Should have one rule');
      assert.equal(rules[0].id, rule.id, 'Rule ID should match');
      assert.equal(rules[0].metric, 'memory', 'Metric should match');
    });

    test('should get process list and filter', async () => {
      const monitor = new SystemMonitorService();

      const allProcesses = await monitor.getProcessList({ limit: 100 });
      assert.ok(Array.isArray(allProcesses), 'Should return array');

      if (allProcesses.length > 0) {
        // Filter for common processes
        const filteredProcesses = await monitor.getProcessList({
          filter: 'node',
          limit: 10
        });

        // On a development machine, there should be at least one node process
        // (the test runner)
        assert.ok(Array.isArray(filteredProcesses), 'Should return filtered array');
      }
    });
  });

  describe('Permission integration', () => {
    test('should check command permissions', async () => {
      const { checkCommandPermission, setConfigForTesting, resetConfig } =
        await import('../../src/security/permission-guard.js');

      // Test sysinfo permission (viewer)
      const sysinfoResult = checkCommandPermission('test-user', 'sysinfo');
      assert.ok(sysinfoResult.allowed, 'sysinfo should be allowed for viewer');

      // Test ps permission (viewer)
      const psResult = checkCommandPermission('test-user', 'ps');
      assert.ok(psResult.allowed, 'ps should be allowed for viewer');

      // Test monitor permission (operator)
      const monitorResult = checkCommandPermission('test-user', 'monitor');
      assert.ok(monitorResult.allowed, 'monitor should be allowed for operator');

      // Test kill permission (admin) - requires high role
      const killResult = checkCommandPermission('test-user', 'kill');
      // Default unknown user is operator, not admin
      // So kill should require confirmation but might not be allowed
      // Let's check the actual behavior
      assert.ok(killResult.requiresConfirmation || !killResult.allowed,
        'kill should require confirmation or be denied');

      resetConfig();
    });
  });

  describe('Command handler integration', () => {
    test('should execute sysinfo handler end-to-end', async () => {
      const { handleSysinfo } = await import('../../src/bot/commands/handlers/sysinfo.js');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await handleSysinfo(handlerCtx);

      assert.equal(replies.length, 1, 'Should send one reply');
      assert.ok(replies[0].length > 50, 'Reply should have substantial content');
    });

    test('should execute ps handler end-to-end', async () => {
      const { handlePs } = await import('../../src/bot/commands/handlers/ps.js');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: []
      };

      await handlePs(handlerCtx);

      assert.equal(replies.length, 1, 'Should send one reply');
    });

    test('should execute monitor handler end-to-end', async () => {
      const { handleMonitor } = await import('../../src/bot/commands/handlers/monitor.js');

      const replies = [];
      const handlerCtx = {
        reply: (msg) => { replies.push(msg); },
        userId: 'test-user',
        sessionId: 'test-session',
        args: ['list']
      };

      await handleMonitor(handlerCtx);

      assert.equal(replies.length, 1, 'Should send one reply');
    });
  });
});
