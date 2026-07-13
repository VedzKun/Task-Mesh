import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import queuesRouter from './routes/queues';
import jobsRouter from './routes/jobs';
import workersRouter from './routes/workers';
import metricsRouter from './routes/metrics';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';

const app = express();

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Global Rate Limiting ──────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});
app.use(limiter);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/queues', queuesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/workers', workersRouter);
app.use('/api/metrics', metricsRouter);

// ── 404 Catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.path} not found` } });
});

// ── Central Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
