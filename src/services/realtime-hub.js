class RealtimeHub {
  #listenersBySession = new Map();

  subscribe(sessionKey, listener) {
    const listeners = this.#listenersBySession.get(sessionKey) ?? new Set();
    listeners.add(listener);
    this.#listenersBySession.set(sessionKey, listeners);

    return () => {
      const current = this.#listenersBySession.get(sessionKey);
      if (!current) {
        return;
      }

      current.delete(listener);
      if (current.size === 0) {
        this.#listenersBySession.delete(sessionKey);
      }
    };
  }

  publish(sessionKey, event) {
    const listeners = this.#listenersBySession.get(sessionKey);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }
}

export const realtimeHub = new RealtimeHub();
