/**
 * Tests for param-sanitizer.js
 * F-006: Safety and Permission Guard
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeParam, validatePath, detectDangerousPatterns } from '../../src/security/param-sanitizer.js';

// detectDangerousPatterns tests
test('detectDangerousPatterns detects path traversal (..)', () => {
  const result = detectDangerousPatterns('../../../etc/passwd');
  assert.equal(result.safe, false);
  assert.ok(result.patterns.some((p) => p.includes('path traversal')));
});

test('detectDangerousPatterns detects shell injection ($)', () => {
  const result = detectDangerousPatterns('$(whoami)');
  assert.equal(result.safe, false);
  assert.ok(result.patterns.length > 0);
});

test('detectDangerousPatterns detects backticks', () => {
  const result = detectDangerousPatterns('`id`');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns detects command separator (;)', () => {
  const result = detectDangerousPatterns('ls; rm -rf /');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns detects command chain (||)', () => {
  const result = detectDangerousPatterns('test || cat /etc/passwd');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns detects command chain (&&)', () => {
  const result = detectDangerousPatterns('test && cat /etc/passwd');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns detects home directory (~)', () => {
  const result = detectDangerousPatterns('~/secret.txt');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns detects --exec flag', () => {
  const result = detectDangerousPatterns('test --exec');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns detects --eval flag', () => {
  const result = detectDangerousPatterns('test --eval');
  assert.equal(result.safe, false);
});

test('detectDangerousPatterns returns safe for clean input', () => {
  const result = detectDangerousPatterns('my-feature-branch');
  assert.equal(result.safe, true);
  assert.deepEqual(result.patterns, []);
});

// sanitizeParam tests
test('sanitizeParam accepts valid string', () => {
  const result = sanitizeParam('valid-input', { maxLength: 200 });
  assert.equal(result.ok, true);
  assert.equal(result.value, 'valid-input');
});

test('sanitizeParam trims whitespace', () => {
  const result = sanitizeParam('  trimmed  ', { maxLength: 200 });
  assert.equal(result.ok, true);
  assert.equal(result.value, 'trimmed');
});

test('sanitizeParam rejects empty input', () => {
  const result = sanitizeParam('', { maxLength: 200 });
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('sanitizeParam rejects whitespace-only input', () => {
  const result = sanitizeParam('   ', { maxLength: 200 });
  assert.equal(result.ok, false);
});

test('sanitizeParam enforces max length', () => {
  const longInput = 'a'.repeat(300);
  const result = sanitizeParam(longInput, { maxLength: 200 });
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('过长'));
});

test('sanitizeParam uses default max length of 200', () => {
  const longInput = 'a'.repeat(250);
  const result = sanitizeParam(longInput);
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects dangerous patterns', () => {
  const result = sanitizeParam('../../../etc/passwd');
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('sanitizeParam handles null input', () => {
  const result = sanitizeParam(null);
  assert.equal(result.ok, false);
});

test('sanitizeParam handles undefined input', () => {
  const result = sanitizeParam(undefined);
  assert.equal(result.ok, false);
});

test('sanitizeParam accepts targetId format [A-Za-z0-9_-]+', () => {
  const result = sanitizeParam('my-feature_123', { maxLength: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.value, 'my-feature_123');
});

// validatePath tests
test('validatePath accepts path within allowed roots', () => {
  const result = validatePath('/project/src/file.js', ['/project', '/home']);
  assert.equal(result.ok, true);
  assert.ok(result.resolved);
});

test('validatePath rejects path outside allowed roots', () => {
  const result = validatePath('/etc/passwd', ['/project', '/home']);
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('validatePath rejects path traversal', () => {
  const result = validatePath('/project/../../../etc/passwd', ['/project']);
  assert.equal(result.ok, false);
});

test('validatePath rejects relative path', () => {
  const result = validatePath('relative/path', ['/project']);
  assert.equal(result.ok, false);
});

test('validatePath handles empty path', () => {
  const result = validatePath('', ['/project']);
  assert.equal(result.ok, false);
});

test('validatePath handles null path', () => {
  const result = validatePath(null, ['/project']);
  assert.equal(result.ok, false);
});

// AC-3.1: Path traversal should be rejected
test('validatePath rejects path traversal with ..', () => {
  const result = validatePath('/project/./src/../test.js', ['/project']);
  // Should reject paths containing .. per AC-3.1
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('..'));
});

test('validatePath accepts valid path within root', () => {
  const result = validatePath('/project/src/test.js', ['/project']);
  assert.equal(result.ok, true);
  assert.equal(result.resolved, '/project/src/test.js');
});

// AC-3.2: targetId parameter only allows [A-Za-z0-9_-]+ format
test('sanitizeParam with isTargetId rejects invalid characters', () => {
  const result = sanitizeParam('feature/branch', { isTargetId: true });
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('格式无效'));
});

test('sanitizeParam with isTargetId accepts valid targetId', () => {
  const result = sanitizeParam('feature-branch_123', { isTargetId: true });
  assert.equal(result.ok, true);
  assert.equal(result.value, 'feature-branch_123');
});

// AC-3.3: reject dangerous characters
test('sanitizeParam rejects semicolon', () => {
  const result = sanitizeParam('test;rm -rf');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects pipe', () => {
  const result = sanitizeParam('test|cat');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects ampersand', () => {
  const result = sanitizeParam('test&&ls');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects dollar sign', () => {
  const result = sanitizeParam('$HOME');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects backtick', () => {
  const result = sanitizeParam('`id`');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects single quote', () => {
  const result = sanitizeParam("test' or '1'='1");
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects double quote', () => {
  const result = sanitizeParam('test" or "1"="1');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects parentheses', () => {
  const result = sanitizeParam('$(whoami)');
  assert.equal(result.ok, false);
});

test('sanitizeParam rejects angle brackets', () => {
  const result = sanitizeParam('<script>');
  assert.equal(result.ok, false);
});
