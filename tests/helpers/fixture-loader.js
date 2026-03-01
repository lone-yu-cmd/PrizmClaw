/**
 * Fixture Loader Helper
 * F-007: Test and Validation Suite
 *
 * Provides lazy-loading utilities for test fixtures.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, '..', 'fixtures');

/**
 * Get absolute path to a fixture file
 * @param {string} relativePath - Path relative to fixtures/ directory
 * @returns {string} Absolute path to the fixture
 */
export function getFixturePath(relativePath) {
  return join(FIXTURES_ROOT, relativePath);
}

/**
 * Load fixture file as string
 * @param {string} relativePath - Path relative to fixtures/ directory
 * @returns {string} File contents as string
 * @throws {Error} If file does not exist
 */
export function loadFixture(relativePath) {
  const fullPath = getFixturePath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Fixture not found: ${relativePath}`);
  }

  return readFileSync(fullPath, 'utf-8');
}

/**
 * Load fixture file as parsed JSON
 * @template T
 * @param {string} relativePath - Path relative to fixtures/ directory
 * @returns {T} Parsed JSON object
 * @throws {Error} If file does not exist or is not valid JSON
 */
export function loadJsonFixture(relativePath) {
  const content = loadFixture(relativePath);

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in fixture ${relativePath}: ${error.message}`);
  }
}

/**
 * Check if a fixture exists
 * @param {string} relativePath - Path relative to fixtures/ directory
 * @returns {boolean}
 */
export function fixtureExists(relativePath) {
  return existsSync(getFixturePath(relativePath));
}

export default {
  getFixturePath,
  loadFixture,
  loadJsonFixture,
  fixtureExists
};
