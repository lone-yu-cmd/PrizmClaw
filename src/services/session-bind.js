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

  constructor({ persistenceDir = config.sessionPersistenceDir } = {}) {
    this.#persistencePath = path.join(persistenceDir, BINDINGS_FILE);
  }

  async init() {
    if (this.#initialized) {
      return;
    }

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
        logger.info('Session bindings file created');
      } else {
        logger.warn({ err: error.message }, 'Failed to load session bindings, starting empty');
        this.#bindings = new Map();
        this.#reverseBindings = new Map();
      }
    }

    this.#initialized = true;
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

    this.#persist();

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

    this.#persist();

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
    this.#persist();

    logger.info('All session bindings cleared');

    return { ok: true };
  }
}

export const sessionBindingService = new SessionBindingService();
export { SessionBindingService };
