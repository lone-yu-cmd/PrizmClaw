/**
 * Alert Manager Service
 * F-012: System Monitor
 *
 * Manages alert rules, threshold monitoring, and notifications.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';

/**
 * @typedef {Object} AlertRule
 * @property {string} id - Unique rule identifier
 * @property {'cpu'|'memory'|'disk'} metric - Metric to monitor
 * @property {'>'|'<'|'>='|'<='} operator - Comparison operator
 * @property {number} threshold - Threshold value (0-100)
 * @property {boolean} enabled - Whether rule is active
 * @property {number} createdAt - Creation timestamp
 * @property {number} [lastTriggered] - Last triggered timestamp
 */

/**
 * @typedef {Object} AlertStatus
 * @property {string} ruleId - Rule that triggered
 * @property {string} metric - Metric name
 * @property {number} currentValue - Current metric value
 * @property {number} threshold - Configured threshold
 * @property {number} triggeredAt - Trigger timestamp
 */

const VALID_METRICS = ['cpu', 'memory', 'disk'];
const VALID_OPERATORS = ['>', '<', '>=', '<='];
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class AlertManagerService {
  /**
   * @param {Object} options
   * @param {string} [options.dataDir] - Directory for persistence
   * @param {string} [options.rulesFile] - Rules file name
   * @param {number} [options.cooldownMs] - Cooldown period in ms
   */
  constructor(options = {}) {
    this.dataDir = options.dataDir || config.systemMonitorDataDir;
    this.rulesFile = options.rulesFile || 'alert-rules.json';
    this.cooldownMs = options.cooldownMs || DEFAULT_COOLDOWN_MS;

    /** @type {Map<string, AlertRule>} */
    this.rules = new Map();

    /** @type {Map<string, number>} - Last triggered time by rule ID */
    this.lastTriggered = new Map();

    /** @type {NodeJS.Timeout|null} */
    this.monitorInterval = null;

    /** @type {Function|null} */
    this.pushCallback = null;
  }

  /**
   * Add a new alert rule
   * @param {Omit<AlertRule, 'id' | 'createdAt'>} ruleData
   * @returns {AlertRule}
   */
  addRule(ruleData) {
    this._validateRule(ruleData);

    const id = randomUUID();
    const rule = {
      id,
      metric: ruleData.metric,
      operator: ruleData.operator,
      threshold: ruleData.threshold,
      enabled: ruleData.enabled ?? true,
      createdAt: Date.now()
    };

    this.rules.set(id, rule);
    return { ...rule };
  }

  /**
   * Remove a rule by ID
   * @param {string} ruleId
   * @returns {boolean}
   */
  removeRule(ruleId) {
    if (!this.rules.has(ruleId)) {
      return false;
    }

    this.rules.delete(ruleId);
    this.lastTriggered.delete(ruleId);
    return true;
  }

  /**
   * List all rules
   * @returns {AlertRule[]}
   */
  listRules() {
    return Array.from(this.rules.values()).map(rule => ({ ...rule }));
  }

  /**
   * Enable a rule
   * @param {string} ruleId
   * @returns {boolean}
   */
  enableRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = true;
    return true;
  }

  /**
   * Disable a rule
   * @param {string} ruleId
   * @returns {boolean}
   */
  disableRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = false;
    return true;
  }

  /**
   * Check thresholds against current metrics
   * @param {Object} currentMetrics - System metrics
   * @returns {AlertStatus[]}
   */
  checkThresholds(currentMetrics) {
    const alerts = [];
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check cooldown
      const lastTrigger = this.lastTriggered.get(rule.id);
      if (lastTrigger && (now - lastTrigger) < this.cooldownMs) {
        continue;
      }

      const currentValue = this._getMetricValue(currentMetrics, rule.metric);
      if (currentValue === undefined) {
        continue;
      }

      if (this._evaluateThreshold(currentValue, rule.operator, rule.threshold)) {
        this.lastTriggered.set(rule.id, now);

        // Update lastTriggered on rule
        rule.lastTriggered = now;

        alerts.push({
          ruleId: rule.id,
          metric: rule.metric,
          currentValue,
          threshold: rule.threshold,
          triggeredAt: now
        });
      }
    }

    return alerts;
  }

  /**
   * Start monitoring loop
   * @param {Function} pushCallback - Callback for alert notifications
   * @param {number} [intervalMs] - Check interval (default from config)
   */
  startMonitoring(pushCallback, intervalMs) {
    if (this.monitorInterval) {
      throw new Error('Monitoring is already running');
    }

    this.pushCallback = pushCallback;
    const interval = intervalMs || config.systemMonitorIntervalMs;

    this.monitorInterval = setInterval(async () => {
      try {
        // Import here to avoid circular dependency
        const { systemMonitorService } = await import('./system-monitor-service.js');
        const metrics = await systemMonitorService.getSystemInfo();
        const alerts = this.checkThresholds(metrics);

        for (const alert of alerts) {
          if (this.pushCallback) {
            this.pushCallback(alert);
          }
        }
      } catch (error) {
        // Log error but don't stop monitoring
        console.error('Alert monitoring error:', error);
      }
    }, interval);
  }

  /**
   * Stop monitoring loop
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.pushCallback = null;
  }

  /**
   * Load rules from persistent storage
   */
  async loadRules() {
    try {
      const filePath = join(this.dataDir, this.rulesFile);
      const content = await readFile(filePath, 'utf-8');
      const rules = JSON.parse(content);

      this.rules.clear();
      for (const rule of rules) {
        if (rule.id && rule.metric) {
          this.rules.set(rule.id, rule);
        }
      }
    } catch (error) {
      // File doesn't exist or is corrupted - start fresh
      this.rules.clear();
    }
  }

  /**
   * Save rules to persistent storage
   */
  async saveRules() {
    try {
      // Ensure directory exists
      await mkdir(this.dataDir, { recursive: true });

      const filePath = join(this.dataDir, this.rulesFile);
      const rules = Array.from(this.rules.values());
      await writeFile(filePath, JSON.stringify(rules, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save alert rules: ${error.message}`);
    }
  }

  /**
   * Parse rule string like "cpu>80"
   * @param {string} ruleString
   * @returns {{metric: string, operator: string, threshold: number}}
   */
  parseRuleString(ruleString) {
    // Match patterns like "cpu>80", "memory>=90", "disk<10"
    const match = ruleString.match(/^(cpu|memory|disk)(>|<|>=|<=)(\d+)$/i);

    if (!match) {
      throw new Error(`Invalid rule format: ${ruleString}. Expected format: cpu>80, memory>=90, disk<10`);
    }

    const metric = match[1].toLowerCase();
    const operator = match[2];
    const threshold = parseInt(match[3], 10);

    if (threshold < 0 || threshold > 100) {
      throw new Error('Threshold must be between 0 and 100');
    }

    return { metric, operator, threshold };
  }

  /**
   * Validate rule data
   * @private
   */
  _validateRule(ruleData) {
    if (!VALID_METRICS.includes(ruleData.metric)) {
      throw new Error(`Invalid metric: ${ruleData.metric}. Must be one of: ${VALID_METRICS.join(', ')}`);
    }

    if (!VALID_OPERATORS.includes(ruleData.operator)) {
      throw new Error(`Invalid operator: ${ruleData.operator}. Must be one of: ${VALID_OPERATORS.join(', ')}`);
    }

    const threshold = Number(ruleData.threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      throw new Error('Threshold must be a number between 0 and 100');
    }
  }

  /**
   * Get metric value from system info
   * @private
   */
  _getMetricValue(metrics, metricName) {
    switch (metricName) {
      case 'cpu':
        return metrics.cpu?.usage;
      case 'memory':
        return metrics.memory?.usagePercent;
      case 'disk':
        return metrics.disk?.usagePercent;
      default:
        return undefined;
    }
  }

  /**
   * Evaluate threshold condition
   * @private
   */
  _evaluateThreshold(currentValue, operator, threshold) {
    switch (operator) {
      case '>':
        return currentValue > threshold;
      case '<':
        return currentValue < threshold;
      case '>=':
        return currentValue >= threshold;
      case '<=':
        return currentValue <= threshold;
      default:
        return false;
    }
  }
}

// Export singleton instance for convenience
export const alertManagerService = new AlertManagerService();

export default AlertManagerService;
