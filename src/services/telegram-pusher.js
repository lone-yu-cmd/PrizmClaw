/**
 * Telegram Pusher Service
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-4: Heartbeat Progress Push, US-5: Error Summary Push
 *
 * Manages Telegram message pushing with throttling, chunking, and heartbeat.
 *
 * Design Decisions:
 * - D2: In-memory queue with retry, non-blocking
 * - D4: Event-driven heartbeat with time throttle
 * - D7: Retry strategy: max 3, exponential backoff (1s → 2s → 4s)
 */

import { randomUUID } from 'node:crypto';

import { loadPipelineInfraConfig as _loadPipelineInfraConfig } from '../pipeline-infra/config-loader.js';

const DEFAULT_THROTTLE_INTERVAL = 30 * 1000; // 30 seconds
const DEFAULT_SEGMENT_INTERVAL = 500; // 500ms between segments
const DEFAULT_ERROR_LINES_COUNT = 10;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_RETRIES = 3;

/**
 * Create a Telegram pusher instance.
 * @param {Object} options - Options
 * @param {Object} options.bot - Telegraf bot instance
 * @param {number} options.targetChatId - Target chat ID
 * @param {number} [options.heartbeatInterval] - Heartbeat interval in ms
 * @param {number} [options.heartbeatFeatureCount] - Features completed before push check
 * @param {number} [options.errorLinesCount] - Error lines to include
 * @param {number} [options.throttleInterval] - Throttle interval in ms
 * @param {number} [options.segmentInterval] - Segment delay in ms
 * @param {number} [options.maxRetries] - Max retry attempts
 * @param {Object} [options.heartbeatConfig] - Heartbeat configuration
 * @returns {Object} Telegram pusher interface
 */
// @ts-ignore — options validated at runtime; default {} for destructuring convenience
export function createTelegramPusher(options = {}) {
  const bot = options.bot;
  const targetChatId = options.targetChatId;
  const heartbeatInterval = options.heartbeatInterval || options.heartbeatConfig?.intervalMs || 30000;
  const _heartbeatFeatureCount = options.heartbeatFeatureCount || 1;
  const errorLinesCount = options.errorLinesCount || options.heartbeatConfig?.errorLinesCount || DEFAULT_ERROR_LINES_COUNT;
  const throttleInterval = options.throttleInterval || DEFAULT_THROTTLE_INTERVAL;
  const segmentInterval = options.segmentInterval || DEFAULT_SEGMENT_INTERVAL;
  const maxRetries = options.maxRetries || MAX_RETRIES;
  const heartbeatConfig = options.heartbeatConfig || {};

  // Internal state
  const heartbeatTimers = new Map(); // type -> timer
  const throttleTimestamps = new Map(); // key -> lastExecutionTime
  const messageQueue = [];
  let queueProcessing = false;

  /**
   * Throttle a function call.
   * @param {string} key - Throttle key
   * @param {Function} fn - Async function to throttle
   * @returns {Promise<void>}
   */
  async function throttle(key, fn) {
    const now = Date.now();
    const lastExecution = throttleTimestamps.get(key) || 0;

    if (now - lastExecution < throttleInterval) {
      // Throttled, skip execution
      return;
    }

    throttleTimestamps.set(key, now);
    await fn();
  }

  /**
   * Split message into chunks respecting Telegram limits.
   * @param {string} text - Text to split
   * @returns {Array<string>} Array of chunks
   */
  function splitMessage(text) {
    if (text.length <= MAX_MESSAGE_LENGTH) {
      return [text];
    }

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Find a good break point
      let breakPoint = MAX_MESSAGE_LENGTH;
      if (remaining.length > MAX_MESSAGE_LENGTH) {
        // Try to break at newline
        const newlineSearch = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
        if (newlineSearch > MAX_MESSAGE_LENGTH / 2) {
          breakPoint = newlineSearch + 1;
        }
      }

      chunks.push(remaining.slice(0, breakPoint));
      remaining = remaining.slice(breakPoint);
    }

    return chunks;
  }

  /**
   * Send a message chunked to respect Telegram limits.
   * @param {number} chatId - Target chat ID
   * @param {string} text - Message text
   * @returns {Promise<Array>} Array of message results
   */
  async function sendMessageChunked(chatId, text) {
    const chunks = splitMessage(text);
    const results = [];
    const total = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      // Add segment numbering for multiple chunks
      let chunk = chunks[i];
      if (total > 1) {
        chunk = `[${i + 1}/${total}] ${chunk}`;
      }

      try {
        const result = await bot.telegram.sendMessage(chatId, chunk, {
          parse_mode: 'Markdown'
        });
        results.push(result);

        // Delay between segments
        if (i < chunks.length - 1 && segmentInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, segmentInterval));
        }
      } catch (error) {
        // Queue for retry
        enqueueMessage({
          id: randomUUID(),
          chatId,
          text: chunk,
          type: 'notification',
          priority: 10,
          retryCount: 0
        });
        results.push({ error: error.message });
      }
    }

    return results;
  }

  /**
   * Send a file to chat.
   * @param {number} chatId - Target chat ID
   * @param {string} content - File content
   * @param {string} filename - Filename
   * @returns {Promise<Object>} Send result
   */
  async function sendFile(chatId, content, filename) {
    try {
      const { Input } = await import('telegraf');
      const buffer = Buffer.from(content, 'utf-8');
      // @ts-ignore — Telegraf Input constructor works at runtime
      const document = new Input(buffer, filename);

      return await bot.telegram.sendDocument(chatId, document, {
        filename
      });
    } catch (_error) {
      // Fallback to chunked message if file send fails
      return sendMessageChunked(chatId, content);
    }
  }

  /**
   * Enqueue a message for async processing.
   * @param {Object} message - Message object
   */
  function enqueueMessage(message) {
    messageQueue.push(message);
    processQueue();
  }

  /**
   * Process message queue with retry logic.
   */
  async function processQueue() {
    if (queueProcessing) return;
    queueProcessing = true;

    while (messageQueue.length > 0) {
      const message = messageQueue.shift();

      try {
        await bot.telegram.sendMessage(message.chatId, message.text, {
          parse_mode: 'Markdown'
        });
      } catch (_error) {
        // Retry with exponential backoff
        if (message.retryCount < maxRetries) {
          message.retryCount++;
          const delay = Math.pow(2, message.retryCount - 1) * 1000; // 1s, 2s, 4s

          await new Promise(resolve => setTimeout(resolve, delay));
          messageQueue.unshift(message); // Re-queue at front
        }
        // If max retries exceeded, discard message (non-blocking)
      }
    }

    queueProcessing = false;
  }

  /**
   * Start heartbeat for a pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @param {Object} aggregator - Status aggregator
   */
  function startHeartbeat(type, aggregator) {
    // Check if heartbeat is enabled
    if (heartbeatConfig.enabled === false) {
      return;
    }

    // Don't start duplicate timers
    if (heartbeatTimers.has(type)) {
      return;
    }

    const timer = setInterval(async () => {
      await throttle(`heartbeat-${type}`, async () => {
        try {
          const status = await aggregator.aggregateStatus(type);
          const formatted = aggregator.formatStatusForTelegram(status);
          await sendMessageChunked(targetChatId, formatted);
        } catch (error) {
          // Log error but don't block
          console.error(`Heartbeat error for ${type}:`, error.message);
        }
      });
    }, heartbeatInterval);

    heartbeatTimers.set(type, timer);
  }

  /**
   * Stop heartbeat for a pipeline type.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   */
  function stopHeartbeat(type) {
    const timer = heartbeatTimers.get(type);
    if (timer) {
      clearInterval(timer);
      heartbeatTimers.delete(type);
    }

    // Process remaining queue
    processQueue();
  }

  /**
   * Handle feature completed event.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @param {string} featureId - Feature ID
   * @param {Object} aggregator - Status aggregator
   */
  async function onFeatureCompleted(type, featureId, aggregator) {
    await throttle(`feature-complete-${type}`, async () => {
      try {
        const status = await aggregator.aggregateStatus(type);
        const message = `✅ Feature 完成: ${featureId}\n\n` +
          `📊 进度: ${status.progress.completed}/${status.progress.total} (${status.progress.successRate}%)`;
        await sendMessageChunked(targetChatId, message);
      } catch (error) {
        console.error(`Feature completed notification error:`, error.message);
      }
    });
  }

  /**
   * Push error summary notification.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @param {string} featureId - Feature ID
   * @param {Object} error - Error object
   * @returns {Promise<Object>} Push result
   */
  async function pushErrorSummary(type, featureId, error) {
    // Check silent mode
    if (heartbeatConfig.silentMode && error.isExpected) {
      return { ok: true, skipped: true };
    }

    const lines = [];
    lines.push(`❌ **执行失败: ${featureId}**`);
    lines.push(`类型: ${error.type || 'unknown'}`);
    lines.push('');

    if (error.message) {
      lines.push(`**错误信息:**`);
      lines.push(error.message);
      lines.push('');
    }

    // Include execution time/duration
    if (error.duration) {
      const mins = Math.floor(error.duration / 60);
      const secs = error.duration % 60;
      lines.push(`⏱️ 执行时间: ${mins}m ${secs}s`);
      lines.push('');
    }

    // Include error log lines
    if (error.logLines && error.logLines.length > 0) {
      lines.push(`**日志片段:** (最后 ${Math.min(errorLinesCount, error.logLines.length)} 行)`);
      const errorLines = error.logLines.slice(-errorLinesCount);
      lines.push('```');
      lines.push(errorLines.join('\n'));
      lines.push('```');
    }

    const message = lines.join('\n');

    try {
      const result = await sendMessageChunked(targetChatId, message);
      return {
        ok: true,
        messageId: result[0]?.message_id
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: 'SEND_FAILED',
        message: err.message
      };
    }
  }

  /**
   * Push startup notification.
   * @param {'feature' | 'bugfix'} type - Pipeline type
   * @param {Object} runInfo - Run info object
   * @returns {Promise<Object>} Push result
   */
  async function pushStartupNotification(type, runInfo) {
    const lines = [];
    lines.push(`🚀 **Pipeline 启动** (${type})`);
    lines.push(`Run ID: ${runInfo.runId}`);
    lines.push(`开始时间: ${runInfo.startedAt}`);
    lines.push('');

    if (runInfo.targets && runInfo.targets.length > 0) {
      lines.push(`**目标列表:** (${runInfo.targets.length} 个)`);
      const displayTargets = runInfo.targets.slice(0, 10);
      for (const target of displayTargets) {
        lines.push(`  • ${target}`);
      }
      if (runInfo.targets.length > 10) {
        lines.push(`  ... 及其他 ${runInfo.targets.length - 10} 个`);
      }
    }

    const message = lines.join('\n');

    try {
      const result = await sendMessageChunked(targetChatId, message);
      return {
        ok: true,
        messageId: result[0]?.message_id
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: 'SEND_FAILED',
        message: err.message
      };
    }
  }

  return {
    throttle,
    sendMessageChunked,
    sendFile,
    enqueueMessage,
    processQueue,
    startHeartbeat,
    stopHeartbeat,
    onFeatureCompleted,
    pushErrorSummary,
    pushStartupNotification
  };
}

export default createTelegramPusher;
