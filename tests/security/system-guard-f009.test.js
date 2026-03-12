/**
 * Tests for F-009 system-guard extensions
 * T-2.1: Extend system-guard.js with blacklist and high-risk detection
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-009 System Guard Extensions', () => {
  describe('checkCommandBlacklist', () => {
    test('should reject blacklisted command', async () => {
      const { checkCommandBlacklist } = await import('../../src/security/system-guard.js');
      const blacklist = ['rm', 'dd', 'mkfs'];
      const result = checkCommandBlacklist('rm -rf /', blacklist);
      assert.equal(result.blocked, true);
      assert.ok(result.reason.includes('rm'));
    });

    test('should allow non-blacklisted command', async () => {
      const { checkCommandBlacklist } = await import('../../src/security/system-guard.js');
      const blacklist = ['rm', 'dd', 'mkfs'];
      const result = checkCommandBlacklist('ls -la', blacklist);
      assert.equal(result.blocked, false);
    });

    test('should handle empty blacklist', async () => {
      const { checkCommandBlacklist } = await import('../../src/security/system-guard.js');
      const result = checkCommandBlacklist('rm -rf /', []);
      assert.equal(result.blocked, false);
    });

    test('should match command prefix, not substring', async () => {
      const { checkCommandBlacklist } = await import('../../src/security/system-guard.js');
      const blacklist = ['rm'];
      // 'rmdir' starts with 'rm', so it would be blocked - this is expected behavior
      const result = checkCommandBlacklist('rmdir /tmp/test', blacklist);
      assert.equal(result.blocked, true);
      assert.ok(result.matchedCommand === 'rm');
    });

    test('should be case-sensitive', async () => {
      const { checkCommandBlacklist } = await import('../../src/security/system-guard.js');
      const blacklist = ['rm'];
      const result = checkCommandBlacklist('RM -rf /', blacklist);
      assert.equal(result.blocked, false);
    });
  });

  describe('detectHighRiskKeywords', () => {
    test('should detect rm -rf', async () => {
      const { detectHighRiskKeywords } = await import('../../src/security/system-guard.js');
      const keywords = ['rm -rf', 'sudo', 'kill'];
      const result = detectHighRiskKeywords('rm -rf /home/user', keywords);
      assert.equal(result.isHighRisk, true);
      assert.ok(result.detectedKeywords.includes('rm -rf'));
    });

    test('should detect sudo', async () => {
      const { detectHighRiskKeywords } = await import('../../src/security/system-guard.js');
      const keywords = ['rm -rf', 'sudo', 'kill'];
      const result = detectHighRiskKeywords('sudo apt update', keywords);
      assert.equal(result.isHighRisk, true);
      assert.ok(result.detectedKeywords.includes('sudo'));
    });

    test('should detect multiple keywords', async () => {
      const { detectHighRiskKeywords } = await import('../../src/security/system-guard.js');
      const keywords = ['rm -rf', 'sudo', 'kill'];
      const result = detectHighRiskKeywords('sudo rm -rf /', keywords);
      assert.equal(result.isHighRisk, true);
      assert.ok(result.detectedKeywords.includes('sudo'));
      assert.ok(result.detectedKeywords.includes('rm -rf'));
    });

    test('should not detect safe command', async () => {
      const { detectHighRiskKeywords } = await import('../../src/security/system-guard.js');
      const keywords = ['rm -rf', 'sudo', 'kill'];
      const result = detectHighRiskKeywords('ls -la /tmp', keywords);
      assert.equal(result.isHighRisk, false);
      assert.deepEqual(result.detectedKeywords, []);
    });

    test('should handle empty keywords list', async () => {
      const { detectHighRiskKeywords } = await import('../../src/security/system-guard.js');
      const result = detectHighRiskKeywords('rm -rf /', []);
      assert.equal(result.isHighRisk, false);
    });

    test('should be case-sensitive for keywords', async () => {
      const { detectHighRiskKeywords } = await import('../../src/security/system-guard.js');
      const keywords = ['sudo'];
      const result = detectHighRiskKeywords('SUDO apt update', keywords);
      assert.equal(result.isHighRisk, false);
    });
  });
});
