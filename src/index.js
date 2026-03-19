import { config } from './config.js';
import { createTelegramBot } from './bot/telegram.js';
import { createHttpServer } from './http/server.js';
import { logger } from './utils/logger.js';

const app = createHttpServer({ logger });
const accessHost = config.webHost === '0.0.0.0' ? '127.0.0.1' : config.webHost;
const server = app.listen(config.webPort, config.webHost, () => {
  logger.info(`Web server running at http://${accessHost}:${config.webPort}`);
  if (config.webHost === '0.0.0.0') {
    logger.info('Server bound to 0.0.0.0; open with localhost or LAN IP instead of 0.0.0.0 in browser.');
  }
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
let botLaunched = false;

const initBotAsync = async () => {
  if (config.enableTelegram) {
    bot = await createTelegramBot();
    const launchPromise = bot.launch();
    botLaunched = true;

    launchPromise
      .then(() => {
        logger.info('Telegram bridge is running.');
      })
      .catch((error) => {
        botLaunched = false;
        logger.error({ err: error instanceof Error ? error.message : String(error) }, 'Failed to launch telegram bot');
      });
  } else {
    logger.info('Telegram bridge disabled by ENABLE_TELEGRAM=false');
  }
};

initBotAsync().catch((error) => {
  logger.error({ err: error.message }, 'Failed to initialize telegram bot');
  logger.warn('Telegram bridge disabled due initialization failure; web API remains available.');
});

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);

  if (bot && botLaunched) {
    try {
      bot.stop(signal);
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'Failed to stop telegram bot gracefully');
    }
  }

  server.close(() => {
    logger.info('HTTP server stopped.');
    process.exit(0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
