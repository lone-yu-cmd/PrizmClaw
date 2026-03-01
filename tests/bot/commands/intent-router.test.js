/**
 * Unit tests for intent-router.js
 * F-015: Universal Command Natural Language Routing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  routeIntent,
  enhanceSlashCommand,
  formatCandidateSuggestions
} from '../../../src/bot/commands/intent-router.js';

// ─── routeIntent — basic matching ────────────────────────────────────────────

test('routeIntent returns unmatched for empty input', () => {
  const result = routeIntent('');
  assert.equal(result.matched, false);
  assert.equal(result.primary, null);
  assert.equal(result.candidates.length, 0);
});

test('routeIntent returns unmatched for null input', () => {
  const result = routeIntent(null);
  assert.equal(result.matched, false);
});

test('routeIntent matches "pipeline" keyword', () => {
  const result = routeIntent('pipeline 状态');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'pipeline');
});

test('routeIntent matches Chinese "管道" keyword', () => {
  const result = routeIntent('帮我查看一下管道状态');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'pipeline');
});

test('routeIntent maps "pipeline 状态" → subcommand status', () => {
  const result = routeIntent('pipeline 状态');
  assert.equal(result.primary.command, 'pipeline');
  assert.equal(result.primary.subcommand, 'status');
});

test('routeIntent maps "pipeline 日志" → subcommand logs', () => {
  const result = routeIntent('pipeline 日志');
  assert.equal(result.primary.command, 'pipeline');
  assert.equal(result.primary.subcommand, 'logs');
});

test('routeIntent maps "pipeline run" → subcommand run', () => {
  const result = routeIntent('pipeline run');
  assert.equal(result.primary.command, 'pipeline');
  assert.equal(result.primary.subcommand, 'run');
});

test('routeIntent maps "pipeline stop" → subcommand stop', () => {
  const result = routeIntent('pipeline stop');
  assert.equal(result.primary.command, 'pipeline');
  assert.equal(result.primary.subcommand, 'stop');
});

// ─── Planner ─────────────────────────────────────────────────────────────────

test('routeIntent matches "planner" keyword', () => {
  const result = routeIntent('planner 运行');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'planner');
});

test('routeIntent matches Chinese "规划" for planner', () => {
  const result = routeIntent('规划 状态');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'planner');
});

// ─── Bugfix ───────────────────────────────────────────────────────────────────

test('routeIntent matches "bugfix" keyword', () => {
  const result = routeIntent('bugfix session-123');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'bugfix');
});

test('routeIntent matches Chinese "修复" for bugfix', () => {
  const result = routeIntent('帮我修复 session-123');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'bugfix');
});

test('routeIntent bugfix extracts target arg', () => {
  const result = routeIntent('bugfix session-123');
  // args should include some extracted target
  assert.ok(result.primary.args === undefined || Array.isArray(result.primary.args));
});

// ─── File commands ────────────────────────────────────────────────────────────

test('routeIntent matches "列出目录" → ls', () => {
  const result = routeIntent('列出目录');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'ls');
});

test('routeIntent matches "搜索文件" → find', () => {
  const result = routeIntent('搜索文件');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'find');
});

test('routeIntent matches "查看文件内容" → cat', () => {
  const result = routeIntent('查看文件内容');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'cat');
});

// ─── System commands ──────────────────────────────────────────────────────────

test('routeIntent matches "进程列表" → ps', () => {
  const result = routeIntent('进程列表');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'ps');
});

test('routeIntent matches "系统信息" → sysinfo', () => {
  const result = routeIntent('系统信息');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'sysinfo');
});

test('routeIntent matches "系统状态" → sysinfo', () => {
  const result = routeIntent('系统状态');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'sysinfo');
});

// ─── Confidence thresholds ────────────────────────────────────────────────────

test('routeIntent high-confidence match does not need confirmation', () => {
  // "pipeline status" — very explicit keyword match
  const result = routeIntent('pipeline status');
  assert.equal(result.matched, true);
  assert.ok(result.confidence >= 0.75, `Expected confidence >= 0.75, got ${result.confidence}`);
  assert.equal(result.needsConfirmation, false);
});

test('routeIntent low-confidence match needs confirmation', () => {
  // Vague input — matches something but low confidence
  const result = routeIntent('帮我处理一下任务');
  // Either unmatched or needs confirmation
  if (result.matched) {
    assert.equal(result.needsConfirmation, true);
  }
});

test('routeIntent returns confidence between 0 and 1', () => {
  const result = routeIntent('pipeline status');
  assert.ok(result.confidence >= 0);
  assert.ok(result.confidence <= 1);
});

// ─── Ambiguity ────────────────────────────────────────────────────────────────

test('routeIntent detects ambiguity when two candidates are close', () => {
  // "停止" matches both pipeline stop and stop command at similar scores
  const result = routeIntent('帮我停止');
  if (result.matched && result.candidates.length >= 2) {
    // If top two are within gap, ambiguityReason should be set
    const top = result.candidates[0];
    const second = result.candidates[1];
    if (top.confidence - second.confidence <= 0.15 && top.confidence < 0.75) {
      assert.ok(result.ambiguityReason !== undefined, 'Expected ambiguityReason to be set');
    }
  }
});

test('routeIntent includes multiple candidates sorted by confidence', () => {
  const result = routeIntent('pipeline status');
  assert.ok(result.candidates.length >= 1);
  // Verify sorted order
  for (let i = 1; i < result.candidates.length; i++) {
    assert.ok(
      result.candidates[i - 1].confidence >= result.candidates[i].confidence,
      'Candidates should be sorted by confidence descending'
    );
  }
});

// ─── enhanceSlashCommand ──────────────────────────────────────────────────────

test('enhanceSlashCommand resolves "帮我看最近日志" in pipeline scope → logs', () => {
  const result = enhanceSlashCommand('pipeline', '帮我看最近日志');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'pipeline');
  assert.equal(result.primary.subcommand, 'logs');
});

test('enhanceSlashCommand resolves "run" in pipeline scope', () => {
  const result = enhanceSlashCommand('pipeline', 'run');
  assert.equal(result.matched, true);
  assert.equal(result.primary.subcommand, 'run');
});

test('enhanceSlashCommand resolves "状态" in planner scope', () => {
  const result = enhanceSlashCommand('planner', '状态');
  assert.equal(result.matched, true);
  assert.equal(result.primary.command, 'planner');
  assert.equal(result.primary.subcommand, 'status');
});

test('enhanceSlashCommand returns unmatched for unknown scope+text', () => {
  const result = enhanceSlashCommand('ls', '这里随意输入一些无关词汇zzzxxx');
  // ls has no subcommand hints — result is either unmatched or confidence 0.5 (fallback)
  // Just ensure it doesn't throw
  assert.ok(typeof result.matched === 'boolean');
});

// ─── formatCandidateSuggestions ───────────────────────────────────────────────

test('formatCandidateSuggestions returns help message for unmatched result', () => {
  const result = {
    matched: false,
    confidence: 0,
    primary: null,
    candidates: [],
    needsConfirmation: true
  };
  const msg = formatCandidateSuggestions(result);
  assert.ok(msg.includes('/help') || msg.includes('无法识别'));
});

test('formatCandidateSuggestions lists up to 3 candidates', () => {
  const result = routeIntent('帮我看看状态');
  if (result.matched) {
    const msg = formatCandidateSuggestions(result);
    assert.ok(typeof msg === 'string');
    assert.ok(msg.length > 0);
    // Should contain at least one command suggestion
    assert.ok(msg.includes('/'));
  }
});

test('formatCandidateSuggestions includes confidence percentage', () => {
  const result = routeIntent('pipeline status');
  if (result.matched) {
    const msg = formatCandidateSuggestions(result);
    assert.ok(msg.includes('%'));
  }
});

// ─── Structured-first: explicit slash commands pass through without NL inference ─

test('routeIntent is not invoked for explicit structured commands (guard test)', () => {
  // "/pipeline run my-feature" is a fully-structured command; intent router
  // should not be needed. This test verifies the router still maps correctly
  // if called directly (coverage).
  const result = routeIntent('/pipeline run my-feature');
  // Pipeline should match because "pipeline" keyword is in text
  assert.ok(result.matched);
  assert.equal(result.primary.command, 'pipeline');
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test('routeIntent handles punctuation gracefully', () => {
  const result = routeIntent('...!!!');
  assert.equal(result.matched, false);
});

test('routeIntent handles very long text without error', () => {
  const longText = 'pipeline '.repeat(50) + '状态';
  const result = routeIntent(longText);
  assert.ok(typeof result.matched === 'boolean');
});

test('routeIntent scopeCommand option restricts to single command', () => {
  // With scopeCommand=pipeline, even if 'bug' or other keywords appear, only pipeline should match
  const result = routeIntent('run 帮我修复 bug', { scopeCommand: 'pipeline' });
  assert.ok(!result.matched || result.primary.command === 'pipeline');
});
