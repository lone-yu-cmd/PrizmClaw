import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('F-012 AlertManagerService', () => {
  let AlertManagerService;
  let tempDir;
  let alertManager;
  let rulesFile;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'alert-manager-test-'));
    rulesFile = join(tempDir, 'alert-rules.json');

    // Import fresh module
    const module = await import('../../src/services/alert-manager-service.js');
    AlertManagerService = module.AlertManagerService;

    // Create instance with temp directory
    alertManager = new AlertManagerService({
      dataDir: tempDir,
      rulesFile: 'alert-rules.json'
    });
  });

  afterEach(async () => {
    // Stop any running monitoring
    if (alertManager) {
      alertManager.stopMonitoring();
    }
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('addRule', () => {
    test('should add a new alert rule', () => {
      const rule = alertManager.addRule({
        metric: 'cpu',
        operator: '>',
        threshold: 80,
        enabled: true
      });

      assert.ok(rule.id, 'Should have generated ID');
      assert.equal(rule.metric, 'cpu');
      assert.equal(rule.operator, '>');
      assert.equal(rule.threshold, 80);
      assert.equal(rule.enabled, true);
      assert.ok(rule.createdAt, 'Should have createdAt timestamp');
    });

    test('should generate unique IDs for different rules', () => {
      const rule1 = alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });
      const rule2 = alertManager.addRule({ metric: 'memory', operator: '>', threshold: 90, enabled: true });

      assert.notEqual(rule1.id, rule2.id, 'IDs should be unique');
    });

    test('should validate metric type', () => {
      assert.throws(() => {
        alertManager.addRule({ metric: 'invalid', operator: '>', threshold: 50, enabled: true });
      }, /invalid metric/i);
    });

    test('should validate operator', () => {
      assert.throws(() => {
        alertManager.addRule({ metric: 'cpu', operator: '==', threshold: 50, enabled: true });
      }, /invalid operator/i);
    });

    test('should validate threshold is a number', () => {
      assert.throws(() => {
        alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 'not-a-number', enabled: true });
      }, /threshold/i);
    });

    test('should validate threshold range (0-100)', () => {
      assert.throws(() => {
        alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 150, enabled: true });
      }, /threshold/i);

      assert.throws(() => {
        alertManager.addRule({ metric: 'cpu', operator: '>', threshold: -10, enabled: true });
      }, /threshold/i);
    });
  });

  describe('removeRule', () => {
    test('should remove an existing rule', () => {
      const rule = alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });
      const result = alertManager.removeRule(rule.id);

      assert.equal(result, true, 'Should return true for successful removal');

      const rules = alertManager.listRules();
      assert.equal(rules.length, 0, 'Rule should be removed');
    });

    test('should return false for non-existent rule', () => {
      const result = alertManager.removeRule('non-existent-id');
      assert.equal(result, false, 'Should return false for non-existent rule');
    });
  });

  describe('listRules', () => {
    test('should return empty array when no rules', () => {
      const rules = alertManager.listRules();
      assert.deepEqual(rules, []);
    });

    test('should return all rules', () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });
      alertManager.addRule({ metric: 'memory', operator: '>', threshold: 90, enabled: true });

      const rules = alertManager.listRules();
      assert.equal(rules.length, 2);
    });
  });

  describe('enableRule / disableRule', () => {
    test('should disable a rule', () => {
      const rule = alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });
      const result = alertManager.disableRule(rule.id);

      assert.equal(result, true);

      const rules = alertManager.listRules();
      assert.equal(rules[0].enabled, false);
    });

    test('should enable a disabled rule', () => {
      const rule = alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: false });
      const result = alertManager.enableRule(rule.id);

      assert.equal(result, true);

      const rules = alertManager.listRules();
      assert.equal(rules[0].enabled, true);
    });

    test('should return false for non-existent rule', () => {
      assert.equal(alertManager.enableRule('non-existent'), false);
      assert.equal(alertManager.disableRule('non-existent'), false);
    });
  });

  describe('checkThresholds', () => {
    test('should detect threshold breach', () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });

      const metrics = {
        cpu: { usage: 85 },
        memory: { usagePercent: 50 },
        disk: { usagePercent: 60 }
      };

      const alerts = alertManager.checkThresholds(metrics);

      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].metric, 'cpu');
      assert.equal(alerts[0].currentValue, 85);
      assert.equal(alerts[0].threshold, 80);
    });

    test('should not alert for disabled rules', () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: false });

      const metrics = {
        cpu: { usage: 85 },
        memory: { usagePercent: 50 },
        disk: { usagePercent: 60 }
      };

      const alerts = alertManager.checkThresholds(metrics);
      assert.equal(alerts.length, 0);
    });

    test('should support different operators', () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });
      alertManager.addRule({ metric: 'memory', operator: '>=', threshold: 90, enabled: true });
      alertManager.addRule({ metric: 'disk', operator: '<', threshold: 10, enabled: true });

      const metrics = {
        cpu: { usage: 85 },    // 85 > 80 -> alert
        memory: { usagePercent: 90 }, // 90 >= 90 -> alert
        disk: { usagePercent: 5 }     // 5 < 10 -> alert
      };

      const alerts = alertManager.checkThresholds(metrics);
      assert.equal(alerts.length, 3);
    });

    test('should not alert when threshold not breached', () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });

      const metrics = {
        cpu: { usage: 75 },
        memory: { usagePercent: 50 },
        disk: { usagePercent: 60 }
      };

      const alerts = alertManager.checkThresholds(metrics);
      assert.equal(alerts.length, 0);
    });
  });

  describe('persistence', () => {
    test('should save rules to file', async () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });

      await alertManager.saveRules();

      const content = await readFile(rulesFile, 'utf-8');
      const savedRules = JSON.parse(content);

      assert.equal(savedRules.length, 1);
      assert.equal(savedRules[0].metric, 'cpu');
    });

    test('should load rules from file', async () => {
      // Write rules directly to file
      const testRules = [{
        id: 'test-id-123',
        metric: 'memory',
        operator: '>=',
        threshold: 90,
        enabled: true,
        createdAt: Date.now()
      }];

      await writeFile(rulesFile, JSON.stringify(testRules));

      await alertManager.loadRules();

      const rules = alertManager.listRules();
      assert.equal(rules.length, 1);
      assert.equal(rules[0].id, 'test-id-123');
    });

    test('should handle missing file gracefully', async () => {
      // Don't create the file
      await alertManager.loadRules();

      const rules = alertManager.listRules();
      assert.deepEqual(rules, []);
    });

    test('should handle corrupted file gracefully', async () => {
      await writeFile(rulesFile, 'not valid json');

      await alertManager.loadRules();

      const rules = alertManager.listRules();
      assert.deepEqual(rules, []);
    });
  });

  describe('monitoring', () => {
    test('should start monitoring', () => {
      const alerts = [];
      alertManager.startMonitoring(() => {}, 1000);

      // Should not throw
      alertManager.stopMonitoring();
    });

    test('should stop monitoring', () => {
      alertManager.startMonitoring(() => {}, 1000);
      alertManager.stopMonitoring();

      // Should not throw when called again
      alertManager.stopMonitoring();
    });

    test('should not start duplicate monitoring', () => {
      alertManager.startMonitoring(() => {}, 1000);

      assert.throws(() => {
        alertManager.startMonitoring(() => {}, 1000);
      }, /already running/i);

      alertManager.stopMonitoring();
    });
  });

  describe('cooldown', () => {
    test('should apply cooldown to prevent spam', () => {
      alertManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });

      const metrics = {
        cpu: { usage: 85 },
        memory: { usagePercent: 50 },
        disk: { usagePercent: 60 }
      };

      // First check should trigger
      const alerts1 = alertManager.checkThresholds(metrics);
      assert.equal(alerts1.length, 1);

      // Immediate second check should not trigger (cooldown)
      const alerts2 = alertManager.checkThresholds(metrics);
      assert.equal(alerts2.length, 0);
    });

    test('should allow alert after cooldown expires', () => {
      // Create instance with very short cooldown for testing
      const shortCooldownManager = new AlertManagerService({
        dataDir: tempDir,
        rulesFile: 'alert-rules-2.json',
        cooldownMs: 10 // 10ms cooldown
      });

      shortCooldownManager.addRule({ metric: 'cpu', operator: '>', threshold: 80, enabled: true });

      const metrics = {
        cpu: { usage: 85 },
        memory: { usagePercent: 50 },
        disk: { usagePercent: 60 }
      };

      // First check
      const alerts1 = shortCooldownManager.checkThresholds(metrics);
      assert.equal(alerts1.length, 1);

      // Wait for cooldown
      return new Promise((resolve) => {
        setTimeout(() => {
          const alerts2 = shortCooldownManager.checkThresholds(metrics);
          assert.equal(alerts2.length, 1);
          resolve();
        }, 50);
      });
    });
  });

  describe('parseRuleString', () => {
    test('should parse "cpu>80" format', () => {
      const result = alertManager.parseRuleString('cpu>80');

      assert.deepEqual(result, {
        metric: 'cpu',
        operator: '>',
        threshold: 80
      });
    });

    test('should parse "memory>=90" format', () => {
      const result = alertManager.parseRuleString('memory>=90');

      assert.deepEqual(result, {
        metric: 'memory',
        operator: '>=',
        threshold: 90
      });
    });

    test('should parse "disk<10" format', () => {
      const result = alertManager.parseRuleString('disk<10');

      assert.deepEqual(result, {
        metric: 'disk',
        operator: '<',
        threshold: 10
      });
    });

    test('should throw for invalid format', () => {
      assert.throws(() => {
        alertManager.parseRuleString('invalid');
      }, /invalid/i);
    });
  });
});
