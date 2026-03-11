/**
 * Param Sanitizer Module
 * F-006: Safety and Permission Guard
 *
 * Provides parameter sanitization and dangerous pattern detection.
 */

import path from 'node:path';

/**
 * Dangerous patterns to detect
 * AC-3.1: Path traversal, absolute path escape, shell metacharacters
 * AC-3.3: Dangerous characters: ; | & $ ` ' " ( ) < >
 */
const DANGEROUS_PATTERNS = [
  { pattern: /\.\./, name: 'path traversal (..)' },
  { pattern: /[`$]/, name: 'shell injection ($ or `)' },
  { pattern: /~/, name: 'home directory (~)' },
  { pattern: /\$\(/, name: 'command substitution ($())' },
  { pattern: /\|\|/, name: 'command chain (||)' },
  { pattern: /&&/, name: 'command chain (&&)' },
  { pattern: /;/, name: 'command separator (;)' },
  { pattern: /\|/, name: 'pipe (|)' },
  { pattern: /&/, name: 'ampersand (&)' },
  { pattern: /--exec\b/, name: 'exec flag (--exec)' },
  { pattern: /--eval\b/, name: 'eval flag (--eval)' },
  { pattern: /'/, name: 'single quote (\')' },
  { pattern: /"/, name: 'double quote (")' },
  { pattern: /\(/, name: 'left parenthesis ((' },
  { pattern: /\)/, name: 'right parenthesis ())' },
  { pattern: /</, name: 'left angle bracket (<)' },
  { pattern: />/, name: 'right angle bracket (>)' }
];

/**
 * TargetId valid format: [A-Za-z0-9_-]+
 */
const TARGET_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Check for dangerous patterns in input
 * @param {string} input
 * @returns {{ safe: boolean, patterns: string[] }}
 */
export function detectDangerousPatterns(input) {
  const detectedPatterns = [];

  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(name);
    }
  }

  return {
    safe: detectedPatterns.length === 0,
    patterns: detectedPatterns
  };
}

/**
 * Sanitize string parameter
 * @param {string} input - Raw input
 * @param {Object} options
 * @param {number} [options.maxLength=200]
 * @param {boolean} [options.isTargetId=false]
 * @param {boolean} [options.isPath=false]
 * @returns {{ ok: boolean, value?: string, error?: string }}
 */
export function sanitizeParam(input, options = {}) {
  const { maxLength = 200, isTargetId = false, isPath = false } = options;

  // Handle null/undefined
  if (input === null || input === undefined) {
    return { ok: false, error: '参数不能为空' };
  }

  // Convert to string and trim
  const text = String(input).trim();

  // Check for empty input
  if (!text) {
    return { ok: false, error: '参数不能为空' };
  }

  // Check max length
  if (text.length > maxLength) {
    return { ok: false, error: `参数过长，最大 ${maxLength} 个字符` };
  }

  // For targetId, check specific format (AC-3.2)
  if (isTargetId) {
    if (!TARGET_ID_PATTERN.test(text)) {
      return { ok: false, error: '目标 ID 格式无效，仅允许字母、数字、下划线和连字符' };
    }
    return { ok: true, value: text };
  }

  // Check for dangerous patterns (AC-3.1, AC-3.3)
  const { safe, patterns } = detectDangerousPatterns(text);
  if (!safe) {
    // For isPath, allow certain patterns that are valid in paths
    if (isPath) {
      // Paths can have / and . but not .. or other dangerous patterns
      const pathSpecificPatterns = patterns.filter(
        (p) =>
          !p.includes('path traversal') ||
          // Only filter path traversal if it's actually .. (handled separately)
          false
      );
      if (pathSpecificPatterns.length > 0) {
        return { ok: false, error: `参数包含危险字符: ${pathSpecificPatterns.join(', ')}` };
      }
    } else {
      return { ok: false, error: `参数包含危险字符: ${patterns.join(', ')}` };
    }
  }

  return { ok: true, value: text };
}

/**
 * Validate path parameter
 * @param {string} inputPath - Path to validate
 * @param {string[]} allowedRoots - Allowed root directories
 * @returns {{ ok: boolean, resolved?: string, error?: string }}
 */
export function validatePath(inputPath, allowedRoots) {
  // Handle null/undefined
  if (!inputPath) {
    return { ok: false, error: '路径不能为空' };
  }

  const text = String(inputPath).trim();
  if (!text) {
    return { ok: false, error: '路径不能为空' };
  }

  // Must be absolute path
  if (!path.isAbsolute(text)) {
    return { ok: false, error: '仅允许绝对路径' };
  }

  // Check for path traversal
  if (text.includes('..')) {
    return { ok: false, error: '路径不允许包含 ..' };
  }

  // Resolve to canonical path
  const resolved = path.resolve(text);

  // Check against allowed roots
  if (allowedRoots && allowedRoots.length > 0) {
    const isWithinRoot = allowedRoots.some((root) => {
      const resolvedRoot = path.resolve(root);
      const relative = path.relative(resolvedRoot, resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });

    if (!isWithinRoot) {
      return { ok: false, error: '路径不在允许的根目录范围内' };
    }
  }

  return { ok: true, resolved };
}

export default {
  sanitizeParam,
  validatePath,
  detectDangerousPatterns
};
