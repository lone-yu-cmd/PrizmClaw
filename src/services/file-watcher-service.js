/**
 * File Watcher Service
 * F-014: Notification and Scheduled Tasks
 *
 * Manages file system monitoring with fs.watch and debouncing.
 * Sends Telegram notifications on file changes.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, access, stat } from 'node:fs/promises';
import { join, resolve, normalize } from 'node:path';
import { watch } from 'node:fs';

class FileWatcherServiceClass {
  #dataDir = null;
  #watchersFile = 'file-watchers.json';
  #maxWatchers = 50;
  #debounceMs = 500;
  #allowedRoots = [];
  #watchers = new Map();
  #fsWatchers = new Map();
  #debounceTimers = new Map();
  #notificationCallback = null;
  #isInitialized = false;

  reset() {
    this.#dataDir = null;
    this.#watchers.clear();
    this.stopAllWatchers();
    this.#notificationCallback = null;
    this.#isInitialized = false;
  }

  isInitialized() {
    return this.#isInitialized;
  }

  initFileWatcherService({ dataDir, watchersFile, maxWatchers, debounceMs, allowedRoots }) {
    this.#dataDir = dataDir;
    if (watchersFile) this.#watchersFile = watchersFile;
    if (maxWatchers !== undefined) this.#maxWatchers = maxWatchers;
    if (debounceMs !== undefined) this.#debounceMs = debounceMs;
    if (allowedRoots) this.#allowedRoots = allowedRoots.map(p => normalize(p));
    this.#isInitialized = true;
  }

  #checkInitialized() {
    if (!this.#isInitialized) {
      throw new Error('FileWatcherService not initialized. Call initFileWatcherService first.');
    }
  }

  async #ensureDataDir() {
    if (this.#dataDir) {
      await mkdir(this.#dataDir, { recursive: true });
    }
  }

  setNotificationCallback(callback) {
    this.#notificationCallback = callback;
  }

  /**
   * Validate path is within allowed roots
   */
  #isPathAllowed(targetPath) {
    if (this.#allowedRoots.length === 0) {
      return true; // No restrictions if no roots defined
    }

    const normalizedPath = normalize(targetPath);
    return this.#allowedRoots.some(root => {
      const normalizedRoot = normalize(root);
      return normalizedPath.startsWith(normalizedRoot);
    });
  }

  /**
   * Add a file watcher
   */
  async addWatch({ path: watchPath, chatId, userId, recursive = true }) {
    this.#checkInitialized();

    // Normalize and resolve path (removes trailing slashes)
    const normalizedPath = resolve(watchPath);

    // Check path is allowed
    if (!this.#isPathAllowed(normalizedPath)) {
      throw new Error(`Path not allowed: ${normalizedPath}. Must be within allowed roots.`);
    }

    // Check path exists
    try {
      await access(normalizedPath);
    } catch {
      throw new Error(`Path does not exist: ${normalizedPath}`);
    }

    // Check max watchers limit
    if (this.#watchers.size >= this.#maxWatchers) {
      throw new Error(`Maximum number of watchers (${this.#maxWatchers}) reached`);
    }

    const id = randomUUID();
    const watcher = {
      id,
      path: normalizedPath,
      chatId,
      userId,
      recursive,
      enabled: true,
      createdAt: Date.now(),
      lastEventAt: null,
      lastEventType: null
    };

    this.#watchers.set(id, watcher);

    return { ...watcher };
  }

  /**
   * Remove a watcher
   */
  removeWatch(watcherId) {
    const watcher = this.#watchers.get(watcherId);
    if (!watcher) return false;

    // Stop any active fs watcher
    this.stopWatching(watcherId);

    this.#watchers.delete(watcherId);
    return true;
  }

  /**
   * List watchers, optionally filtered by chatId
   */
  listWatches({ chatId } = {}) {
    const watchers = Array.from(this.#watchers.values());
    if (chatId) {
      return watchers.filter(w => w.chatId === chatId).map(w => ({ ...w }));
    }
    return watchers.map(w => ({ ...w }));
  }

  /**
   * Get a single watcher by ID
   */
  getWatch(watcherId) {
    const watcher = this.#watchers.get(watcherId);
    return watcher ? { ...watcher } : null;
  }

  /**
   * Start watching a path
   */
  startWatching(watcherId) {
    const watcher = this.#watchers.get(watcherId);
    if (!watcher || !watcher.enabled) return false;

    // Already watching?
    if (this.#fsWatchers.has(watcherId)) {
      return true;
    }

    try {
      const fsWatcher = watch(
        watcher.path,
        { recursive: watcher.recursive },
        (eventType, filename) => {
          this.#handleFileEvent(watcherId, eventType, filename);
        }
      );

      fsWatcher.on('error', (error) => {
        console.error(`File watcher error for ${watcher.path}:`, error.message);
      });

      this.#fsWatchers.set(watcherId, fsWatcher);
      return true;
    } catch (error) {
      console.error(`Failed to start watching ${watcher.path}:`, error.message);
      return false;
    }
  }

  /**
   * Handle file change event with debouncing
   */
  #handleFileEvent(watcherId, eventType, filename) {
    const watcher = this.#watchers.get(watcherId);
    if (!watcher) return;

    // Clear existing debounce timer
    const existingTimer = this.#debounceTimers.get(watcherId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      // Update watcher state
      watcher.lastEventAt = Date.now();
      watcher.lastEventType = eventType;

      // Notify via callback
      if (this.#notificationCallback) {
        await this.#notificationCallback(watcher.chatId, {
          ...watcher,
          eventType,
          filename
        });
      }

      this.#debounceTimers.delete(watcherId);
    }, this.#debounceMs);

    this.#debounceTimers.set(watcherId, timer);
  }

  /**
   * Stop watching a path
   */
  stopWatching(watcherId) {
    const fsWatcher = this.#fsWatchers.get(watcherId);
    if (fsWatcher) {
      fsWatcher.close();
      this.#fsWatchers.delete(watcherId);
    }

    // Clear any pending debounce timer
    const timer = this.#debounceTimers.get(watcherId);
    if (timer) {
      clearTimeout(timer);
      this.#debounceTimers.delete(watcherId);
    }

    return true;
  }

  /**
   * Stop all watchers
   */
  stopAllWatchers() {
    for (const [watcherId] of this.#fsWatchers) {
      this.stopWatching(watcherId);
    }
  }

  /**
   * Check if a watcher is active
   */
  isWatcherActive(watcherId) {
    return this.#fsWatchers.has(watcherId);
  }

  /**
   * Save watchers to disk
   */
  async saveWatches() {
    this.#checkInitialized();
    await this.#ensureDataDir();

    const filePath = join(this.#dataDir, this.#watchersFile);
    const watchers = Array.from(this.#watchers.values());
    await writeFile(filePath, JSON.stringify(watchers, null, 2), 'utf-8');
  }

  /**
   * Load watchers from disk
   */
  async loadWatches() {
    this.#checkInitialized();

    try {
      const filePath = join(this.#dataDir, this.#watchersFile);
      const content = await readFile(filePath, 'utf-8');
      const watchers = JSON.parse(content);

      this.#watchers.clear();
      for (const watcher of watchers) {
        if (watcher.id && watcher.path && watcher.chatId) {
          this.#watchers.set(watcher.id, watcher);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load watchers:', error.message);
      }
      this.#watchers.clear();
    }
  }

  /**
   * Restore watchers - load from disk and start watching
   */
  async restoreWatches() {
    await this.loadWatches();

    // Start watching all enabled watchers
    for (const watcher of this.#watchers.values()) {
      if (watcher.enabled) {
        this.startWatching(watcher.id);
      }
    }
  }
}

export const fileWatcherService = new FileWatcherServiceClass();
export default FileWatcherServiceClass;
