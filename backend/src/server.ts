import 'dotenv/config';
import http from 'http';
import app from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startCronScheduler } from './services/cronScheduler';
import { startWebSocketServer } from './services/websocket';

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = http.createServer(app);

// Start WebSocket server for live dashboard updates
startWebSocketServer(server);

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    // Start internal cron scheduler (handles cron jobs + DLQ cleanup)
    startCronScheduler();

    server.listen(PORT, () => {
      logger.info(`Task-Mesh API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed gracefully');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main();
