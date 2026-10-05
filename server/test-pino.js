import pino from 'pino';
console.log('Pino imported');
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});
console.log('Logger created');
logger.info('Test log');
