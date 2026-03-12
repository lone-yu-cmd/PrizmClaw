/**
 * Alias Store
 * F-013: Session and Context Manager
 *
 * Manages persistent command aliases for users.
 * Aliases are stored in a JSON file for persistence across bot restarts.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * @typedef {Object} AliasStore
 * @property {Function} initAliasStore - Initialize with persistence path
 * @property {Function} setAlias - Define an alias
 * @property {Function} getAlias - Get specific alias
 * @property {Function} getAllAliases - Get all aliases for user
 * @property {Function} deleteAlias - Remove an alias
 * @property {Function} resolveAlias - Get command string for alias
 * @property {Function} loadAliases - Load from file
 * @property {Function} saveAliases - Persist to file
 */

class AliasStoreClass {
  #persistencePath = null;
  #aliases = new Map(); // Map<userId, Map<aliasName, command>>
  #isInitialized = false;

  /**
   * Reset the store state (for testing).
   */
  reset() {
    this.#persistencePath = null;
    this.#aliases = new Map();
    this.#isInitialized = false;
  }

  /**
   * Check if store is initialized.
   * @returns {boolean}
   */
  isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Initialize the alias store.
   * @param {Object} options - Initialization options
   * @param {string} options.persistencePath - Path to JSON file for persistence
   */
  async initAliasStore({ persistencePath }) {
    this.#persistencePath = persistencePath;
    this.#isInitialized = true;

    // Load existing aliases
    await this.loadAliases();
  }

  /**
   * Check if store is initialized.
   * @throws {Error} If not initialized
   */
  #checkInitialized() {
    if (!this.#isInitialized) {
      throw new Error('AliasStore not initialized. Call initAliasStore first.');
    }
  }

  /**
   * Load aliases from the persistence file.
   */
  async loadAliases() {
    this.#checkInitialized();

    try {
      const content = await readFile(this.#persistencePath, 'utf-8');
      const data = JSON.parse(content);

      // Convert to Map structure
      this.#aliases = new Map();
      for (const [userId, userAliases] of Object.entries(data)) {
        this.#aliases.set(userId, new Map(Object.entries(userAliases)));
      }
    } catch (error) {
      // If file doesn't exist or is corrupted, start fresh
      if (error.code !== 'ENOENT') {
        console.error('Failed to load aliases file:', error.message);
      }
      this.#aliases = new Map();
    }
  }

  /**
   * Save aliases to the persistence file.
   */
  async saveAliases() {
    this.#checkInitialized();

    // Convert Map to plain object
    const data = {};
    for (const [userId, userAliases] of this.#aliases) {
      data[userId] = Object.fromEntries(userAliases);
    }

    // Ensure parent directory exists
    await mkdir(dirname(this.#persistencePath), { recursive: true });

    await writeFile(this.#persistencePath, JSON.stringify(data, null, 2));
  }

  /**
   * Set an alias for a user.
   * @param {string} userId - Telegram user ID
   * @param {string} name - Alias name
   * @param {string} command - Command string
   */
  async setAlias(userId, name, command) {
    this.#checkInitialized();

    // Validate alias name (no spaces, special chars)
    if (!name || name.includes(' ') || name.includes('=')) {
      throw new Error('Invalid alias name: must not contain spaces or equals sign');
    }

    if (!this.#aliases.has(userId)) {
      this.#aliases.set(userId, new Map());
    }

    this.#aliases.get(userId).set(name, command);

    // Persist
    await this.saveAliases();
  }

  /**
   * Get a specific alias.
   * @param {string} userId - Telegram user ID
   * @param {string} name - Alias name
   * @returns {string|null} Command string or null if not found
   */
  getAlias(userId, name) {
    this.#checkInitialized();

    const userAliases = this.#aliases.get(userId);
    if (!userAliases) {
      return null;
    }

    return userAliases.get(name) || null;
  }

  /**
   * Get all aliases for a user.
   * @param {string} userId - Telegram user ID
   * @returns {Object} Object with alias name -> command pairs
   */
  getAllAliases(userId) {
    this.#checkInitialized();

    const userAliases = this.#aliases.get(userId);
    if (!userAliases) {
      return {};
    }

    return Object.fromEntries(userAliases);
  }

  /**
   * Delete an alias.
   * @param {string} userId - Telegram user ID
   * @param {string} name - Alias name
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteAlias(userId, name) {
    this.#checkInitialized();

    const userAliases = this.#aliases.get(userId);
    if (!userAliases || !userAliases.has(name)) {
      return false;
    }

    userAliases.delete(name);

    // Persist
    await this.saveAliases();

    return true;
  }

  /**
   * Resolve an alias to its command.
   * @param {string} userId - Telegram user ID
   * @param {string} name - Alias name
   * @returns {string|null} Command string or null if not found
   */
  resolveAlias(userId, name) {
    return this.getAlias(userId, name);
  }

  /**
   * Clear all aliases and reset initialization state (for testing).
   */
  clear() {
    this.#aliases.clear();
    this.#isInitialized = false;
    this.#persistencePath = null;
  }
}

export const aliasStore = new AliasStoreClass();
