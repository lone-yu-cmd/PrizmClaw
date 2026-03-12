import { config } from './config.js';
import { createTelegramBot } from './bot/telegram.js';
import { createHttpServer } from './http/server.js';
import { logger } from './utils/logger.js';

const app = createHttpServer({ logger });
const server = app.listen(config.webPort, config.webHost, () => {
  logger.info(`Web server running at http://${config.webHost}:${config.webPort}`);
  logger.info(
    {
      enableTelegram: config.enableTelegram,
      webPort: config.webPort,
      pipelineDir: config.pipelineInfra.pipelineDir,
      platform: config.pipelineInfra.platform,
      logLevel: config.logLevel,
    },
    'Config loaded successfully'
  );
});

let bot = null;

if (config.enableTelegram) {
  bot = createTelegramBot();
  bot.launch().then(() => {
    logger.info('Telegram bridge is running.');
  });
} else {
  logger.info('Telegram bridge disabled by ENABLE_TELEGRAM=false');
}

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);

  if (bot) {
    bot.stop(signal);
  }

  server.close(() => {
    logger.info('HTTP server stopped.');
    process.exit(0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
