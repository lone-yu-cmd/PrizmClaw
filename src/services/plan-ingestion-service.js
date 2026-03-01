// @ts-nocheck
/**
 * Plan Ingestion Service
 * Manages plan file validation, versioning, and registry.
 * Implements T-010 to T-014 for F-003.
 */

import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

/**
 * Schema type identifiers
 * @typedef {'feature-list' | 'bug-fix-list'} PlanType
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {PlanType | 'unknown'} type - Detected plan type
 * @property {ValidationError[]} errors - Validation errors
 * @property {PlanSummary} [summary] - Content summary if valid
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} path - JSON path to the error
 * @property {string} message - Human-readable error message
 * @property {string} [keyword] - JSON Schema keyword
 */

/**
 * @typedef {Object} PlanSummary
 * @property {PlanType} type - Plan type
 * @property {string} name - App/project name
 * @property {number} itemCount - Number of features/bugs
 * @property {Record<string, number>} statusBreakdown - Status counts
 */

/**
 * @typedef {Object} VersionInfo
 * @property {string} version - Version identifier
 * @property {Date} timestamp - Creation timestamp
 * @property {number} size - File size in bytes
 * @property {number} itemCount - Number of items
 * @property {boolean} isValid - Whether file is valid
 */

/**
 * @typedef {Object} SaveResult
 * @property {boolean} success - Whether save succeeded
 * @property {string} [version] - Version identifier
 * @property {string} [error] - Error message
 */

/**
 * @typedef {Object} ActiveMeta
 * @property {string} version - Current version
 * @property {string} path - Path to current version file
 * @property {Date} lastModified - Last modification time
 * @property {number} itemCount - Number of items
 */

/**
 * @typedef {Object} RollbackResult
 * @property {string} previousVersion - Version we rolled back from
 * @property {string} currentVersion - Version we rolled back to
 */

/**
 * Schema mapping from $schema value to type
 */
const SCHEMA_TYPE_MAP = {
  'dev-pipeline-feature-list-v1': 'feature-list',
  'dev-pipeline-bug-fix-list-v1': 'bug-fix-list'
};

/**
 * Schema file paths relative to project root
 */
const SCHEMA_PATHS = {
  'feature-list': 'dev-pipeline/templates/feature-list-schema.json',
  'bug-fix-list': 'dev-pipeline/templates/bug-fix-list-schema.json'
};

/**
 * Create plan ingestion service.
 * @param {Object} config - Service configuration
 * @param {string} [config.projectRoot] - Project root directory
 * @param {string} [config.plansDir] - Plans directory (overrides projectRoot)
 * @returns {Object} Service instance
 */
export function createPlanIngestionService(config = {}) {
  const projectRoot = config.projectRoot || process.cwd();
  const plansDir = config.plansDir || path.join(projectRoot, 'plans');

  // Cached Ajv instance and compiled schemas
  const ajv = new Ajv({ allErrors: true, strict: false });
  const compiledSchemaCache = new Map();

  /**
   * Load and compile schema by type.
   * @param {PlanType} type - Schema type
   * @returns {Object} Schema object
   */
  function loadSchema(type) {
    // Check if we have a valid schema type first
    if (!SCHEMA_PATHS[type]) {
      throw new Error(`Unknown schema type: ${type}`);
    }

    const schemaPath = path.join(projectRoot, SCHEMA_PATHS[type]);
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found for type: ${type}`);
    }

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    return JSON.parse(schemaContent);
  }

  /**
   * Get compiled validator for schema type (internal).
   * @param {PlanType} type - Schema type
   * @returns {Function} Compiled validator function
   */
  function getCompiledValidator(type) {
    if (compiledSchemaCache.has(type)) {
      return compiledSchemaCache.get(type);
    }

    const schema = loadSchema(type);
    const compiled = ajv.compile(schema);
    compiledSchemaCache.set(type, compiled);
    return compiled;
  }

  /**
   * Detect plan type from $schema field.
   * @param {Object} parsed - Parsed JSON content
   * @returns {PlanType | 'unknown'}
   */
  function detectType(parsed) {
    if (!parsed || typeof parsed !== 'object') {
      return 'unknown';
    }

    const schemaValue = parsed.$schema;
    if (typeof schemaValue !== 'string') {
      return 'unknown';
    }

    return SCHEMA_TYPE_MAP[schemaValue] || 'unknown';
  }

  /**
   * Generate summary from parsed content.
   * @param {PlanType} type - Plan type
   * @param {Object} parsed - Parsed content
   * @returns {PlanSummary}
   */
  function generateSummary(type, parsed) {
    const name = type === 'feature-list' ? parsed.app_name : parsed.project_name;
    const items = type === 'feature-list' ? parsed.features : parsed.bugs;
    const itemCount = Array.isArray(items) ? items.length : 0;

    const statusBreakdown = {};
    if (Array.isArray(items)) {
      for (const item of items) {
        const status = item.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      }
    }

    return { type, name: name || 'Unknown', itemCount, statusBreakdown };
  }

  /**
   * Convert Ajv errors to ValidationError format.
   * @param {Array} ajvErrors - Ajv error objects
   * @returns {ValidationError[]}
   */
  function convertAjvErrors(ajvErrors) {
    if (!Array.isArray(ajvErrors)) {
      return [];
    }

    return ajvErrors.map((err) => ({
      path: err.instancePath || err.schemaPath || '/',
      message: err.message || 'Validation error',
      keyword: err.keyword
    }));
  }

  /**
   * Validate plan content.
   * @param {string} content - JSON string content
   * @returns {ValidationResult}
   */
  function validate(content) {
    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return {
        valid: false,
        type: 'unknown',
        errors: [{ path: '/', message: `Invalid JSON: ${e.message}` }]
      };
    }

    // Detect type
    const type = detectType(parsed);
    if (type === 'unknown') {
      return {
        valid: false,
        type: 'unknown',
        errors: [{ path: '/$schema', message: 'Unknown or missing $schema field' }]
      };
    }

    // Load and run schema validation
    const validator = getCompiledValidator(type);
    const valid = validator(parsed);

    if (!valid) {
      return {
        valid: false,
        type,
        errors: convertAjvErrors(validator.errors)
      };
    }

    // Generate summary
    const summary = generateSummary(type, parsed);

    return { valid: true, type, errors: [], summary };
  }

  /**
   * Format validation errors for display.
   * @param {ValidationError[]} errors - Validation errors
   * @returns {string} Formatted error message
   */
  function formatValidationErrors(errors) {
    if (!Array.isArray(errors) || errors.length === 0) {
      return '';
    }

    const lines = ['\u274c \u6821\u9a8c\u5931\u8d25:'];

    for (const error of errors) {
      const path = error.path || '/';
      const message = error.message || 'Unknown error';
      lines.push(`\u2022 ${path}: ${message}`);
    }

    return lines.join('\n');
  }

  /**
   * Get type directory path.
   * @param {PlanType} type - Plan type
   * @returns {string}
   */
  function getTypeDir(type) {
    return path.join(plansDir, type);
  }

  /**
   * Generate version string from timestamp.
   * @param {Date} date - Timestamp
   * @returns {string} Version string like v20260312-143052
   */
  function generateVersion(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `v${year}${month}${day}-${hour}${minute}${second}`;
  }

  /**
   * Ensure type directory exists.
   * @param {PlanType} type - Plan type
   */
  function ensureTypeDir(type) {
    const typeDir = getTypeDir(type);
    fs.mkdirSync(typeDir, { recursive: true });
  }

  /**
   * Save plan content as new version.
   * @param {PlanType} type - Plan type
   * @param {string} content - JSON content
   * @param {Object} meta - Upload metadata
   * @param {number} meta.uploadedBy - User ID who uploaded
   * @returns {Promise<SaveResult>}
   */
  async function save(type, content, _meta = {}) {
    try {
      ensureTypeDir(type);

      const version = generateVersion();
      const versionPath = path.join(getTypeDir(type), `${version}.json`);

      // Count items
      let _itemCount = 0;
      try {
        const parsed = JSON.parse(content);
        const items = type === 'feature-list' ? parsed.features : parsed.bugs;
        _itemCount = Array.isArray(items) ? items.length : 0;
      } catch {
        // Ignore parse errors, already validated
      }

      // Write file
      fs.writeFileSync(versionPath, content, 'utf-8');

      return { success: true, version };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * List all versions for a plan type.
   * @param {PlanType} type - Plan type
   * @returns {Promise<VersionInfo[]>}
   */
  async function listVersions(type) {
    const typeDir = getTypeDir(type);
    if (!fs.existsSync(typeDir)) {
      return [];
    }

    const files = fs.readdirSync(typeDir);
    const versions = [];

    for (const file of files) {
      if (!file.endsWith('.json') || file === '_current.json') {
        continue;
      }

      const match = file.match(/^(v\d{8}-\d{6})\.json$/);
      if (!match) {
        continue;
      }

      const version = match[1];
      const filePath = path.join(typeDir, file);
      const stat = fs.statSync(filePath);

      // Try to read and count items
      let itemCount = 0;
      let isValid = true;
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const items = type === 'feature-list' ? parsed.features : parsed.bugs;
        itemCount = Array.isArray(items) ? items.length : 0;
      } catch {
        isValid = false;
      }

      versions.push({
        version,
        timestamp: stat.mtime,
        size: stat.size,
        itemCount,
        isValid
      });
    }

    // Sort by version descending (newest first)
    versions.sort((a, b) => b.version.localeCompare(a.version));

    return versions;
  }

  /**
   * Get content of a specific version.
   * @param {PlanType} type - Plan type
   * @param {string} version - Version identifier
   * @returns {Promise<string | null>}
   */
  async function getVersion(type, version) {
    const versionPath = path.join(getTypeDir(type), `${version}.json`);
    if (!fs.existsSync(versionPath)) {
      return null;
    }
    return fs.readFileSync(versionPath, 'utf-8');
  }

  /**
   * Get path to _current.json file.
   * @param {PlanType} type - Plan type
   * @returns {string}
   */
  function getCurrentMetaPath(type) {
    return path.join(getTypeDir(type), '_current.json');
  }

  /**
   * Set the current active version.
   * @param {PlanType} type - Plan type
   * @param {string} version - Version to activate
   * @returns {Promise<boolean>}
   */
  async function setCurrent(type, version) {
    // Verify version exists
    const versionPath = path.join(getTypeDir(type), `${version}.json`);
    if (!fs.existsSync(versionPath)) {
      return false;
    }

    // Read content to get item count
    let itemCount = 0;
    try {
      const content = fs.readFileSync(versionPath, 'utf-8');
      const parsed = JSON.parse(content);
      const items = type === 'feature-list' ? parsed.features : parsed.bugs;
      itemCount = Array.isArray(items) ? items.length : 0;
    } catch {
      // Ignore
    }

    // Write _current.json
    const currentMeta = {
      version,
      activatedAt: new Date().toISOString(),
      path: versionPath,
      itemCount
    };

    const currentMetaPath = getCurrentMetaPath(type);
    fs.writeFileSync(currentMetaPath, JSON.stringify(currentMeta, null, 2), 'utf-8');

    return true;
  }

  /**
   * Get current active version metadata.
   * @param {PlanType} type - Plan type
   * @returns {Promise<ActiveMeta | null>}
   */
  async function getCurrent(type) {
    const currentMetaPath = getCurrentMetaPath(type);
    if (!fs.existsSync(currentMetaPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(currentMetaPath, 'utf-8');
      const meta = JSON.parse(content);

      return {
        version: meta.version,
        path: meta.path,
        lastModified: new Date(meta.activatedAt),
        itemCount: meta.itemCount || 0
      };
    } catch {
      return null;
    }
  }

  /**
   * Get path to the current active version file.
   * @param {PlanType} type - Plan type
   * @returns {string | null}
   */
  function getActivePath(type) {
    const currentMetaPath = getCurrentMetaPath(type);
    if (!fs.existsSync(currentMetaPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(currentMetaPath, 'utf-8');
      const meta = JSON.parse(content);
      return meta.path || null;
    } catch {
      return null;
    }
  }

  /**
   * Rollback to previous version.
   * @param {PlanType} type - Plan type
   * @returns {Promise<RollbackResult | null>}
   */
  async function rollback(type) {
    const versions = await listVersions(type);
    if (versions.length < 2) {
      return null;
    }

    const current = await getCurrent(type);
    if (!current) {
      return null;
    }

    // Find current version index
    const currentIndex = versions.findIndex((v) => v.version === current.version);
    if (currentIndex === -1 || currentIndex >= versions.length - 1) {
      return null;
    }

    // Get previous version
    const previousVersion = versions[currentIndex + 1];
    if (!previousVersion) {
      return null;
    }

    // Set previous as current
    const success = await setCurrent(type, previousVersion.version);
    if (!success) {
      return null;
    }

    return {
      previousVersion: current.version,
      currentVersion: previousVersion.version
    };
  }

  return {
    loadSchema,
    validate,
    formatValidationErrors,
    save,
    listVersions,
    getVersion,
    setCurrent,
    getCurrent,
    getActivePath,
    rollback
  };
}

export default createPlanIngestionService;
