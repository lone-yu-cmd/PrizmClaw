import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const BINDINGS_FILE = 'session-bindings.json';

class SessionBindingService {
  #bindings = null; // Map: webSessionId -> telegramChatId
  #reverseBindings = null; // Map: telegramChatId -> Set<webSessionId>
  #initialized = false;
  #persistencePath;
  #lastPersistPromise = Promise.resolve();
  #initPromise = null;

  constructor({ persistenceDir = config.sessionPersistenceDir } = {}) {
    this.#persistencePath = path.join(persistenceDir, BINDINGS_FILE);
  }

  async init() {
    if (this.#initialized) {
      return;
    }

    // If init is already in progress, wait for it
    if (this.#initPromise) {
      return this.#initPromise;
    }

    this.#initPromise = this.#doInit();
    return this.#initPromise;
  }

  async #doInit() {
    try {
      const data = await readFile(this.#persistencePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.#bindings = new Map(Object.entries(parsed.bindings || {}));
      this.#reverseBindings = new Map();

      // Build reverse index
      for (const [webSessionId, telegramChatId] of this.#bindings.entries()) {
        if (!this.#reverseBindings.has(telegramChatId)) {
          this.#reverseBindings.set(telegramChatId, new Set());
        }
        this.#reverseBindings.get(telegramChatId).add(webSessionId);
      }

      logger.info(
        { bindingsCount: this.#bindings.size },
        'Session bindings loaded'
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create directory if needed
        await mkdir(path.dirname(this.#persistencePath), { recursive: true });
        this.#bindings = new Map();
        this.#reverseBindings = new Map();
        await this.#persist();
        logger.info('Session bindings file created');
      } else {
        logger.warn({ err: error.message }, 'Failed to load session bindings, starting empty');
        this.#bindings = new Map();
        this.#reverseBindings = new Map();
      }
    }

    this.#initialized = true;
  }

  /**
   * Ensure the service is initialized. If init was triggered by the factory,
   * this will await completion. For manual usage, callers should call init() first.
   */
  async #ensureInitialized() {
    if (this.#initialized) {
      return;
    }
    if (this.#initPromise) {
      await this.#initPromise;
      return;
    }
    throw new Error('SessionBindingService not initialized. Call init() first.');
  }

  async #persist() {
    try {
      const serialized = {
        bindings: Object.fromEntries(this.#bindings),
        updatedAt: new Date().toISOString()
      };
      await writeFile(
        this.#persistencePath,
        JSON.stringify(serialized, null, 2)
      );
    } catch (error) {
      logger.error({ err: error.message }, 'Failed to persist session bindings');
    }
  }

  bindSession(webSessionId, telegramChatId) {
    if (!this.#initialized) {
      throw new Error('SessionBindingService not initialized. Call init() first.');
    }

    const normalizedWebId = String(webSessionId).trim();
    const normalizedChatId = String(telegramChatId).trim();

    if (!normalizedWebId) {
      throw new Error('webSessionId cannot be empty');
    }

    if (!normalizedChatId) {
      throw new Error('telegramChatId cannot be empty');
    }

    // Remove any existing binding for this web session
    if (this.#bindings.has(normalizedWebId)) {
      const oldChatId = this.#bindings.get(normalizedWebId);
      this.#reverseBindings.get(oldChatId)?.delete(normalizedWebId);
    }

    // Create new binding
    this.#bindings.set(normalizedWebId, normalizedChatId);

    // Update reverse index
    if (!this.#reverseBindings.has(normalizedChatId)) {
      this.#reverseBindings.set(normalizedChatId, new Set());
    }
    this.#reverseBindings.get(normalizedChatId).add(normalizedWebId);

    this.#lastPersistPromise = this.#persist();

    logger.info(
      { webSessionId: normalizedWebId, telegramChatId: normalizedChatId },
      'Session bound to Telegram chat'
    );

    return { ok: true };
  }

  unbindSession(webSessionId) {
    if (!this.#initialized) {
      throw new Error('SessionBindingService not initialized. Call init() first.');
    }

    const normalizedWebId = String(webSessionId).trim();

    if (!normalizedWebId) {
      throw new Error('webSessionId cannot be empty');
    }

    if (!this.#bindings.has(normalizedWebId)) {
      return { ok: false, error: 'No binding found for this session' };
    }

    const telegramChatId = this.#bindings.get(normalizedWebId);
    this.#bindings.delete(normalizedWebId);

    // Update reverse index
    this.#reverseBindings.get(telegramChatId)?.delete(normalizedWebId);

    this.#lastPersistPromise = this.#persist();

    logger.info(
      { webSessionId: normalizedWebId },
      'Session unbound from Telegram chat'
    );

    return { ok: true };
  }

  getBoundChatId(webSessionId) {
    if (!this.#initialized) {
      throw new Error('SessionBindingService not initialized. Call init() first.');
    }

    const normalizedWebId = String(webSessionId).trim();
    return this.#bindings.get(normalizedWebId) || null;
  }

  getBoundWebSessions(telegramChatId) {
    if (!this.#initialized) {
      throw new Error('SessionBindingService not initialized. Call init() first.');
    }

    const normalizedChatId = String(telegramChatId).trim();
    const sessions = this.#reverseBindings.get(normalizedChatId);
    return sessions ? Array.from(sessions) : [];
  }

  getAllBindings() {
    if (!this.#initialized) {
      throw new Error('SessionBindingService not initialized. Call init() first.');
    }

    return Object.fromEntries(this.#bindings);
  }

  clearAllBindings() {
    if (!this.#initialized) {
      throw new Error('SessionBindingService not initialized. Call init() first.');
    }

    this.#bindings.clear();
    this.#reverseBindings.clear();
    this.#lastPersistPromise = this.#persist();

    logger.info('All session bindings cleared');

    return { ok: true };
  }

  /**
   * Wait for any pending persistence operation to complete.
   * Also waits for initialization if it's in progress.
   * Useful for tests that need to verify file contents after mutation.
   * @returns {Promise<void>}
   */
  async flush() {
    if (this.#initPromise) {
      await this.#initPromise;
    }
    await this.#lastPersistPromise;
  }

  /**
   * Check if the service is initialized.
   * @returns {boolean}
   */
  get isInitialized() {
    return this.#initialized;
  }

  /**
   * Ensure initialization is complete (awaits pending init).
   * Use this in async contexts to guarantee the service is ready.
   * @returns {Promise<void>}
   */
  async ensureReady() {
    await this.#ensureInitialized();
  }
}

/**
 * Factory function to create and auto-initialize a SessionBindingService instance.
 * Matches the import pattern expected by server.js.
 *
 * The returned service starts initialization immediately. Callers must
 * await service.ensureReady() or service.init() before calling synchronous
 * methods (bindSession, getBoundChatId, etc.) in async contexts.
 *
 * @param {Object} [options]
 * @param {string} [options.bindingsPath] - Full path to the bindings JSON file.
 *   If provided, persistenceDir is derived from its directory.
 * @param {string} [options.persistenceDir] - Directory for persistence (used if bindingsPath not provided).
 * @returns {SessionBindingService} A SessionBindingService instance with init in progress
 */
export function createSessionBindService({ bindingsPath, persistenceDir } = {}) {
  const opts = {};
  if (bindingsPath) {
    opts.persistenceDir = path.dirname(bindingsPath);
  } else if (persistenceDir) {
    opts.persistenceDir = persistenceDir;
  }

  const service = new SessionBindingService(opts);

  // Start initialization immediately
  service.init().catch((err) => {
    logger.error({ err: err.message }, 'Failed to auto-initialize SessionBindingService');
  });

  return service;
}

export const sessionBindingService = new SessionBindingService();
export { SessionBindingService };
