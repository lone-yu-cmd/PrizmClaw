import { Telegraf } from 'telegraf';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { isAllowedUser } from '../security/guard.js';
import { chatWithSession, resetSession } from '../services/chat-service.js';
import { captureScreenshot } from '../services/screenshot-service.js';
import { executeSystemCommand } from '../services/system-exec-service.js';

const TELEGRAM_MSG_CHUNK_SIZE = 3800;
const STREAM_MIN_CHARS = 220;
const STREAM_FLUSH_INTERVAL_MS = 1200;
const TYPING_INTERVAL_MS = 3500;

function splitMessage(text, chunkSize = TELEGRAM_MSG_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function extractImageMarkers(text = '') {
  const markerRegex = /@image:([^\s`]+)/g;
  const imageRefs = [];
  const cleanedText = text.replace(markerRegex, (_full, rawRef) => {
    const ref = String(rawRef ?? '').trim();
    if (!ref) {
      return '';
    }
    imageRefs.push(ref);
    return '';
  });

  return {
    imageRefs,
    cleanedText: cleanedText.replace(/\n{3,}/g, '\n\n').trim()
  };
}

async function resolveLocalImagePath(imageRef) {
  const normalized = String(imageRef ?? '').trim();
  if (!normalized) {
    return null;
  }

  const candidates = path.isAbsolute(normalized)
    ? [normalized]
    : [
        path.resolve(process.cwd(), normalized),
        path.resolve(process.cwd(), path.basename(normalized)),
        path.resolve('/Users/loneyu/Desktop', path.basename(normalized))
      ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // ignore
    }
  }

  return null;
}

async function replyImages(ctx, imageRefs = []) {
  const results = [];

  for (const imageRef of imageRefs) {
    const filePath = await resolveLocalImagePath(imageRef);
    if (!filePath) {
      results.push({ imageRef, sent: false, reason: 'not_found' });
      continue;
    }

    try {
      await ctx.replyWithPhoto({ source: filePath });
      results.push({ imageRef, sent: true });
    } catch (error) {
      results.push({ imageRef, sent: false, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}

async function replyLargeText(ctx, text) {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

async function safeEditMessageText(ctx, messageId, text) {
  const nextText = text && text.trim() ? text : ' ';

  try {
    await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, nextText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('message is not modified')) {
      return;
    }
    throw error;
  }
}

function createEditableStreamPublisher(ctx) {
  let fullText = '';
  let renderedText = '';
  let pendingChars = 0;
  let lastFlushAt = 0;
  let flushChain = Promise.resolve();
  let activeMessage = null;
  let activeSegmentIndex = 0;
  let publishedMessageCount = 0;

  async function ensureActiveMessage() {
    if (activeMessage) {
      return;
    }
    activeMessage = await ctx.reply('处理中...');
    activeSegmentIndex = 0;
    publishedMessageCount += 1;
  }

  async function render(force = false) {
    const now = Date.now();

    if (!force && pendingChars < STREAM_MIN_CHARS && now - lastFlushAt < STREAM_FLUSH_INTERVAL_MS) {
      return;
    }

    if (fullText === renderedText) {
      pendingChars = 0;
      return;
    }

    await ensureActiveMessage();

    const segments = splitMessage(fullText);
    const targetLastIndex = Math.max(segments.length - 1, 0);

    while (activeSegmentIndex < targetLastIndex) {
      const text = segments[activeSegmentIndex] ?? ' ';
      await safeEditMessageText(ctx, activeMessage.message_id, text);

      activeMessage = await ctx.reply('继续输出中...');
      activeSegmentIndex += 1;
      publishedMessageCount += 1;
    }

    const activeText = segments[targetLastIndex] ?? ' ';
    await safeEditMessageText(ctx, activeMessage.message_id, activeText);

    renderedText = fullText;
    pendingChars = 0;
    lastFlushAt = now;
  }

  function enqueueRender(force = false) {
    flushChain = flushChain.then(() => render(force));
  }

  return {
    push(text) {
      const appendText = text ?? '';
      if (!appendText) {
        return;
      }
      fullText += appendText;
      pendingChars += appendText.length;
      enqueueRender(false);
    },
    setFinalText(text) {
      fullText = text ?? '';
      pendingChars = Math.max(pendingChars, STREAM_MIN_CHARS);
      enqueueRender(true);
    },
    async finish() {
      enqueueRender(true);
      await flushChain;
      return {
        outputLength: renderedText.length,
        messageCount: publishedMessageCount
      };
    }
  };
}

function buildSessionId(ctx) {
  return String(ctx.chat.id);
}

function ensureAllowed(ctx) {
  const userId = ctx.from?.id;
  if (!isAllowedUser(userId)) {
    throw new Error('当前账号未被授权使用该机器人。');
  }
}

export function createTelegramBot() {
  const bot = new Telegraf(config.telegramBotToken);

  bot.start(async (ctx) => {
    await ctx.reply('PrizmClaw 已启动。可直接聊天，也可用 /screenshot 和 /exec。');
  });

  bot.help(async (ctx) => {
    await ctx.reply('命令：\n/reset - 清空会话\n/screenshot - 获取本地截图\n/exec <command> - 执行系统命令');
  });

  bot.command('reset', async (ctx) => {
    try {
      ensureAllowed(ctx);
      resetSession({ channel: 'telegram', sessionId: buildSessionId(ctx) });
      await ctx.reply('已清空当前会话上下文。');
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : String(error));
    }
  });

  bot.command('screenshot', async (ctx) => {
    try {
      ensureAllowed(ctx);
      await ctx.reply('正在获取截图。');
      const { buffer } = await captureScreenshot();
      await ctx.replyWithPhoto({ source: buffer }, { caption: '当前本地屏幕截图' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to capture screenshot in telegram');
      await ctx.reply(`截图失败：${message}`);
    }
  });

  bot.command('exec', async (ctx) => {
    try {
      ensureAllowed(ctx);
      const payload = ctx.message.text.replace('/exec', '').trim();
      if (!payload) {
        await ctx.reply('请提供命令，例如 /exec pwd');
        return;
      }

      await ctx.reply('正在执行命令。');
      const result = await executeSystemCommand(payload);
      const output = [
        `exitCode: ${result.exitCode}`,
        result.stdout ? `stdout:\n${result.stdout}` : 'stdout: (empty)',
        result.stderr ? `stderr:\n${result.stderr}` : 'stderr: (empty)'
      ].join('\n\n');

      await replyLargeText(ctx, output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, 'Failed to exec command in telegram');
      await ctx.reply(`执行失败：${message}`);
    }
  });

  bot.on('text', async (ctx) => {
    const sessionId = buildSessionId(ctx);

    let typingTimer = null;

    try {
      ensureAllowed(ctx);
      await ctx.sendChatAction('typing');

      const streamPublisher = createEditableStreamPublisher(ctx);
      typingTimer = setInterval(() => {
        ctx.sendChatAction('typing').catch(() => undefined);
      }, TYPING_INTERVAL_MS);

      const reply = await chatWithSession({
        channel: 'telegram',
        sessionId,
        message: ctx.message.text,
        realtimeHooks: {
          onStatus: ({ stage }) => {
            if (stage === 'running') {
              ctx.sendChatAction('typing').catch(() => undefined);
            }
          },
          onAssistantChunk: ({ text }) => {
            streamPublisher.push(text);
          }
        }
      });

      const { imageRefs, cleanedText } = extractImageMarkers(reply);
      const finalText = cleanedText || '已执行，见下方图片。';

      streamPublisher.setFinalText(finalText);
      const streamed = await streamPublisher.finish();
      if (streamed.outputLength === 0) {
        await replyLargeText(ctx, finalText);
      }

      if (imageRefs.length > 0) {
        const imageSendResults = await replyImages(ctx, imageRefs);
        const failed = imageSendResults.filter((item) => !item.sent);

        if (failed.length > 0) {
          const failedList = failed
            .map((item) => {
              const reason = item.reason === 'not_found' ? '文件不存在或不可访问' : item.reason;
              return `- @image:${item.imageRef}${reason ? `（${reason}）` : ''}`;
            })
            .join('\n');
          await ctx.reply(`以下图片发送失败，已附回原始引用：\n${failedList}`);
          logger.warn({ sessionId, failed }, 'Some images failed to send to telegram');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message, sessionId }, 'Failed to process telegram message');
      await ctx.reply(`处理失败：${message}`);
    } finally {
      if (typingTimer) {
        clearInterval(typingTimer);
      }
    }
  });

  return bot;
}
