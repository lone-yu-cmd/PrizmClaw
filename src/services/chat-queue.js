class ChatQueue {
  #chains = new Map();

  run(chatId, job) {
    const prev = this.#chains.get(chatId) ?? Promise.resolve();

    const next = prev
      .catch(() => undefined)
      .then(job)
      .finally(() => {
        if (this.#chains.get(chatId) === next) {
          this.#chains.delete(chatId);
        }
      });

    this.#chains.set(chatId, next);
    return next;
  }
}

export const chatQueue = new ChatQueue();
