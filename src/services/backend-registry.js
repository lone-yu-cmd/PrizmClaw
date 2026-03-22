import { accessSync, constants } from 'node:fs';
import { logger } from '../utils/logger.js';

/**
 * Backend Registry Service
 * Manages available AI CLI backends with validation and discovery.
 */
export class BackendRegistry {
  #backends = new Map();
  #defaultBackendName = null;
  #validator;

  /**
   * Create a new BackendRegistry instance.
   * @param {Object} options - Registry options
   * @param {Function} [options.validator] - Custom binary validator function
   */
  constructor(options = {}) {
    this.#validator = options.validator || this.#defaultValidator;
  }

  /**
   * Set validator for testing purposes.
   * @param {Function} validator - Binary validator function
   */
  setValidator(validator) {
    this.#validator = validator;
  }

  /**
   * Register a new AI CLI backend.
   * @param {string} name - Backend name (e.g., 'claude', 'codebuddy')
   * @param {string} binPath - Path to the backend binary
   * @param {Object} options - Additional backend options
   * @param {string} [options.description] - Backend description
   * @param {string[]} [options.aliases] - Backend aliases
   * @param {string} [options.permissionFlag] - Permission flag (e.g. '-y')
   * @param {number} [options.timeoutMs] - Custom timeout in milliseconds
   * @throws {Error} If backend is already registered or binary path is invalid
   */
  registerBackend(name, binPath, options = {}) {
    if (this.#backends.has(name)) {
      throw new Error(`Backend "${name}" is already registered`);
    }

    // Validate binary path exists and is executable
    this.#validateBinaryPath(binPath);

    const backend = {
      name,
      binPath,
      description: options.description || `${name} CLI backend`,
      aliases: options.aliases || [],
      permissionFlag: options.permissionFlag ?? null,
      timeoutMs: options.timeoutMs ?? null,
      registeredAt: Date.now()
    };

    this.#backends.set(name, backend);
    logger.debug(`Registered backend: ${name} -> ${binPath}`);

    // Set as default if no default is set yet
    if (!this.#defaultBackendName) {
      this.#defaultBackendName = name;
    }

    return backend;
  }

  /**
   * Update fields on an already-registered backend.
   * @param {string} name - Backend name
   * @param {Object} fields - Fields to update (description, permissionFlag, timeoutMs)
   * @throws {Error} If backend is not registered
   */
  updateBackend(name, fields) {
    const backend = this.#backends.get(name);
    if (!backend) {
      throw new Error(`Backend "${name}" is not registered`);
    }
    if (fields.description !== undefined) backend.description = fields.description;
    if (fields.permissionFlag !== undefined) backend.permissionFlag = fields.permissionFlag;
    if (fields.timeoutMs !== undefined) backend.timeoutMs = fields.timeoutMs;
    logger.debug(`Updated backend: ${name}`);
  }

  /**
   * Unregister a backend.
   * @param {string} name - Backend name to unregister
   */
  unregisterBackend(name) {
    if (this.#backends.has(name)) {
      this.#backends.delete(name);

      // Reset default backend if it was the one being unregistered
      if (this.#defaultBackendName === name) {
        this.#defaultBackendName = this.#backends.size > 0
          ? Array.from(this.#backends.keys())[0]
          : null;
      }

      logger.debug(`Unregistered backend: ${name}`);
    }
  }

  /**
   * Get backend by name.
   * @param {string} name - Backend name
   * @returns {Object|undefined} Backend object or undefined if not found
   */
  getBackend(name) {
    return this.#backends.get(name);
  }

  /**
   * List all registered backends.
   * @returns {Array} Array of backend objects
   */
  listBackends() {
    return Array.from(this.#backends.values());
  }

  /**
   * Validate that a backend exists and its binary is accessible.
   * @param {string} name - Backend name
   * @returns {boolean} True if backend is valid and accessible
   */
  validateBackend(name) {
    const backend = this.getBackend(name);
    if (!backend) {
      return false;
    }

    try {
      this.#validateBinaryPath(backend.binPath);
      return true;
    } catch (error) {
      logger.warn(`Backend validation failed for ${name}: ${error.message}`);
      return false;
    }
  }

  /**
   * Set the default backend.
   * @param {string} name - Backend name to set as default
   * @throws {Error} If backend is not registered
   */
  setDefaultBackend(name) {
    if (!this.#backends.has(name)) {
      throw new Error(`Backend "${name}" is not registered`);
    }

    this.#defaultBackendName = name;
    logger.debug(`Set default backend to: ${name}`);
  }

  /**
   * Get the default backend.
   * @returns {Object|null} Default backend object or null if no backends registered
   */
  getDefaultBackend() {
    if (!this.#defaultBackendName) {
      return null;
    }
    return this.getBackend(this.#defaultBackendName);
  }

  /**
   * Get the default backend name.
   * @returns {string|null} Default backend name or null if no backends registered
   */
  getDefaultBackendName() {
    return this.#defaultBackendName;
  }

  /**
   * Clear all registered backends.
   */
  clear() {
    this.#backends.clear();
    this.#defaultBackendName = null;
    logger.debug('Cleared all backends from registry');
  }

  /**
   * Get backend by alias.
   * @param {string} alias - Backend alias
   * @returns {Object|undefined} Backend object or undefined if not found
   */
  getBackendByAlias(alias) {
    for (const backend of this.#backends.values()) {
      if (backend.aliases.includes(alias)) {
        return backend;
      }
    }
    return undefined;
  }

  /**
   * Validate that a binary path exists and is executable.
   * @param {string} binPath - Binary path to validate
   * @throws {Error} If binary path is invalid
   * @private
   */
  #validateBinaryPath(binPath) {
    this.#validator(binPath);
  }

  /**
   * Default binary validator using file system access.
   * @param {string} binPath - Binary path to validate
   * @throws {Error} If binary path is invalid
   * @private
   */
  #defaultValidator(binPath) {
    try {
      accessSync(binPath, constants.X_OK);
    } catch (error) {
      throw new Error(`Binary path "${binPath}" is not accessible or executable: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
export const backendRegistry = new BackendRegistry();