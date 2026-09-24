import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
dotenv.config();

import logger from './config/logger.js';
import { connectDB } from './config/db.js';
import { queueManager } from './services/queue/queueService.js';
import { startFolderWatcher } from './services/importer/folderWatcher.js';

import statsRoutes from './routes/statsRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import importRoutes from './routes/importRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/stats')) {
    logger.debug({ method: req.method, url: req.url }, 'Incoming request');
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'JOB APPLICATION MAILER',
  });
});

// Mount Routes
app.use('/api/stats', statsRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/imports', importRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error in request');
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server helper
export async function startServer(port = process.env.PORT || 5001, host = process.env.HOST || '127.0.0.1') {
  try {
    await connectDB();
    await queueManager.recoverOrphanedJobs();

    // Start incoming folder watcher
    startFolderWatcher();

    const server = app.listen(port, host, () => {
      logger.info(`==================================================`);
      logger.info(`  JOB APPLICATION MAILER SERVER STARTED`);
      logger.info(`  Listening on: http://${host}:${port}`);
      logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`  Dry Run Mode: ${process.env.DRY_RUN !== 'false' ? 'ENABLED' : 'DISABLED'}`);
      logger.info(`==================================================`);
    });

    // Gracefully release port on nodemon restart and termination
    process.once('SIGUSR2', () => {
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    });

    process.on('SIGINT', () => {
      server.close(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
    });

    return server;
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to start server');
    throw error;
  }
}

// Only start listener if run directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error(err, 'Server startup fatal error');
    process.exit(1);
  });
}

export default app;
