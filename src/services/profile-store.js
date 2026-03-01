/**
 * F-021: Multi-Backend Profile Store
 *
 * Persists AI CLI backend profiles to a JSON file.
 * Each profile captures: name, binPath, permissionFlag, timeoutMs, description.
 * The default profile (derived from CODEBUDDY_BIN) is protected and cannot be removed.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';

/**
 * @typedef {Object} Profile
 * @property {string} name - Unique profile name
 * @property {string} binPath - Path to the CLI binary
 * @property {string} [permissionFlag] - Permission flag (e.g. '-y')
 * @property {number} [timeoutMs] - Custom timeout in milliseconds
 * @property {string} [description] - Human-readable description
 * @property {boolean} [isDefault] - True if this is the protected default profile
 */

export class ProfileStore {
  /** @type {Map<string, Profile>} */
  #profiles = new Map();
  #persistencePath;
  #defaultProfileName = null;

  /**
   * @param {Object} options
   * @param {string} options.persistencePath - File path for JSON persistence
   */
  constructor(options = {}) {
    this.#persistencePath = options.persistencePath || 'data/cli-profiles.json';
  }

  /**
   * Initialize the store: load from disk if file exists.
   * @param {Object} [options]
   * @param {string} [options.persistencePath] - Override persistence path
   * @returns {Promise<void>}
   */
  async init(options = {}) {
    if (options.persistencePath) {
      this.#persistencePath = options.persistencePath;
    }
    try {
      const raw = await readFile(this.#persistencePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.profiles)) {
        for (const p of data.profiles) {
          this.#profiles.set(p.name, p);
        }
      }
      if (data.defaultProfileName) {
        this.#defaultProfileName = data.defaultProfileName;
      }
      logger.debug(`ProfileStore: loaded ${this.#profiles.size} profiles from ${this.#persistencePath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`ProfileStore: failed to load profiles: ${err.message}`);
      }
      // No file yet — start empty
    }
  }

  /**
   * Set the default profile name (the protected profile that cannot be deleted).
   * @param {string} name
   */
  setDefaultProfileName(name) {
    this.#defaultProfileName = name;
  }

  /**
   * Get the default profile name.
   * @returns {string|null}
   */
  getDefaultProfileName() {
    return this.#defaultProfileName;
  }

  /**
   * Add or update a profile. Persists to disk.
   * @param {Profile} profile
   * @returns {Promise<Profile>}
   */
  async addProfile(profile) {
    if (!profile.name || !profile.binPath) {
      throw new Error('Profile must have a name and binPath');
    }
    const entry = {
      name: profile.name,
      binPath: profile.binPath,
      permissionFlag: profile.permissionFlag ?? null,
      timeoutMs: profile.timeoutMs ?? null,
      description: profile.description ?? `${profile.name} CLI backend`,
      isDefault: profile.name === this.#defaultProfileName
    };
    this.#profiles.set(profile.name, entry);
    await this.#persist();
    logger.debug(`ProfileStore: added profile "${profile.name}"`);
    return entry;
  }

  /**
   * Remove a profile by name. Throws if it's the default profile.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async removeProfile(name) {
    if (name === this.#defaultProfileName) {
      throw new Error(`Cannot remove the default profile "${name}"`);
    }
    if (!this.#profiles.has(name)) {
      throw new Error(`Profile "${name}" not found`);
    }
    this.#profiles.delete(name);
    await this.#persist();
    logger.debug(`ProfileStore: removed profile "${name}"`);
  }

  /**
   * Get a profile by name.
   * @param {string} name
   * @returns {Profile|undefined}
   */
  getProfile(name) {
    return this.#profiles.get(name);
  }

  /**
   * List all profiles.
   * @returns {Profile[]}
   */
  listProfiles() {
    return Array.from(this.#profiles.values());
  }

  /**
   * Returns true if the profile store has a profile with the given name.
   * @param {string} name
   * @returns {boolean}
   */
  hasProfile(name) {
    return this.#profiles.has(name);
  }

  /**
   * Clear all profiles (for testing).
   */
  clear() {
    this.#profiles.clear();
    this.#defaultProfileName = null;
  }

  /**
   * Persist profiles to disk.
   * @private
   */
  async #persist() {
    try {
      await mkdir(dirname(this.#persistencePath), { recursive: true });
      const data = {
        defaultProfileName: this.#defaultProfileName,
        profiles: Array.from(this.#profiles.values())
      };
      await writeFile(this.#persistencePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      logger.warn(`ProfileStore: failed to persist profiles: ${err.message}`);
    }
  }
}

// Singleton instance
export const profileStore = new ProfileStore();
