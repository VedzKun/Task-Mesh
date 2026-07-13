import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { calculateRetryDelay } from './retryCalculator';
import { createLogger, format, transports } from 'winston';

// ── Worker-local Prisma client ─────────────────────────────────────────────
const prisma = new PrismaClient({
  log: ['error'],
});

const logger = createLogger({
  level: 'debug',
  format: format.combine(format.timestamp(), format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

// ── Worker config ─────────────────────────────────────────────────────────────
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '10000', 10);

let workerId: string;
let isShuttingDown = false;
let activeJobs = 0;

// ── Worker Registration ───────────────────────────────────────────────────────
async function registerWorker(): Promise<string> {
  const worker = await prisma.worker.create({
    data: {
      hostname: os.hostname(),
      pid: process.pid,
      concurrency: CONCURRENCY,
      status: 'IDLE',
      metadata: { version: '1.0.0', nodeVersion: process.version },
    },
  });
  logger.info(`Worker registered: ${worker.id}`);
  return worker.id;
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
async function sendHeartbeat() {
  const memUsage = process.memoryUsage();
  await prisma.worker.update({
    where: { id: workerId },
    data: {
      lastHeartbeat: new Date(),
      currentJobs: activeJobs,
      status: isShuttingDown ? 'DRAINING' : activeJobs > 0 ? 'BUSY' : 'IDLE',
    },
  });
  await prisma.workerHeartbeat.create({
    data: {
      workerId,
      currentJobs: activeJobs,
      memoryMb: memUsage.heapUsed / 1024 / 1024,
    },
  });
}

// ── Atomic Job Claim (SKIP LOCKED) ───────────────────────────────────────────
/**
 * Uses raw SQL with SELECT...FOR UPDATE SKIP LOCKED to atomically claim one job.
 * This is the core of preventing duplicate execution across concurrent workers.
 */
async function claimNextJob() {
  const result = await prisma.$transaction(async (tx) => {
    // Raw query for SKIP LOCKED — Prisma ORM doesn't expose this natively
    const jobs = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM jobs
      WHERE status = 'QUEUED'
        AND run_at <= NOW()
        AND locked_by IS NULL
        AND queue_id IN (
          SELECT id FROM queues WHERE is_paused = false
        )
      ORDER BY priority DESC, run_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (!jobs.length) return null;

    const jobId = jobs[0].id;
    const claimed = await tx.job.update({
      where: { id: jobId },
      data: {
        status: 'CLAIMED',
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
      include: { queue: { include: { retryPolicy: true } }, retryPolicy: true },
    });

    return claimed;
  });

  return result;
}

// ── Job Execution Simulation ──────────────────────────────────────────────────
/**
 * Simulates executing the job's payload.
 * In a real system, this would dispatch based on job.name to a handler registry.
 */
async function executeJob(job: any): Promise<{ success: boolean; result?: any; error?: Error }> {
  // Simulate variable execution time based on payload
  const durationMs = Math.floor(Math.random() * 3000) + 500;
  
  await new Promise((resolve) => setTimeout(resolve, durationMs));

  // Simulate 15% failure rate for demonstration
  if (Math.random() < 0.15) {
    throw new Error(`Simulated failure for job: ${job.name}`);
  }

  return { success: true, result: { processed: true, durationMs } };
}

// ── Process Single Job ────────────────────────────────────────────────────────
async function processJob(job: any) {
  const startedAt = new Date();
  activeJobs++;

  logger.info(`Starting job: ${job.name} [${job.id}] attempt ${job.attempts}`);

  // Create execution record
  const execution = await prisma.jobExecution.create({
    data: { jobId: job.id, workerId, attempt: job.attempts, status: 'RUNNING' },
  });

  // Mark job as RUNNING
  await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING' } });

  try {
    const resultData = await executeJob(job);
    const durationMs = Date.now() - startedAt.getTime();

    // ── SUCCESS PATH ──────────────────────────────────────────────────────
    const jsonResult = JSON.parse(JSON.stringify(resultData));
    await prisma.$transaction([
      prisma.jobExecution.update({
        where: { id: execution.id },
        data: { status: 'SUCCEEDED', completedAt: new Date(), durationMs, resultData: jsonResult },
      }),
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), lockedAt: null, lockedBy: null },
      }),
      prisma.jobLog.create({
        data: { jobId: job.id, level: 'INFO', message: `Job completed in ${durationMs}ms`, meta: jsonResult },
      }),
    ]);

    logger.info(`✓ Job completed: ${job.name} [${job.id}] in ${durationMs}ms`);
  } catch (err: any) {
    const durationMs = Date.now() - startedAt.getTime();
    const errorMessage = err.message || 'Unknown error';

    logger.error(`✗ Job failed: ${job.name} [${job.id}]`, { error: errorMessage });

    // Determine retry delay using the retry policy
    const retryPolicy = job.retryPolicy || job.queue?.retryPolicy;
    const canRetry = job.attempts < job.maxRetries;

    if (canRetry && retryPolicy) {
      const delayMs = calculateRetryDelay(
        {
          strategy: retryPolicy.strategy,
          baseDelayMs: retryPolicy.baseDelayMs,
          maxDelayMs: retryPolicy.maxDelayMs,
          multiplier: retryPolicy.multiplier,
          maxAttempts: retryPolicy.maxAttempts,
        },
        job.attempts
      );

      const nextRunAt = new Date(Date.now() + delayMs);
      logger.info(`Scheduling retry for ${job.name} in ${delayMs}ms`);

      await prisma.$transaction([
        prisma.jobExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', completedAt: new Date(), durationMs, errorMessage, errorStack: err.stack },
        }),
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'SCHEDULED', runAt: nextRunAt, lockedAt: null, lockedBy: null, lastError: errorMessage },
        }),
        prisma.jobLog.create({
          data: { jobId: job.id, level: 'WARN', message: `Retry ${job.attempts}/${job.maxRetries} in ${delayMs}ms`, meta: { error: errorMessage, nextRunAt } },
        }),
      ]);
    } else {
      // ── DEAD LETTER QUEUE ──────────────────────────────────────────────
      logger.warn(`Moving job to DLQ: ${job.name} [${job.id}]`);
      await prisma.$transaction([
        prisma.jobExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', completedAt: new Date(), durationMs, errorMessage, errorStack: err.stack },
        }),
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'DLQ', lockedAt: null, lockedBy: null, lastError: errorMessage },
        }),
        prisma.deadLetterQueue.create({
          data: {
            jobId: job.id,
            queueId: job.queueId,
            reason: errorMessage,
            originalPayload: job.payload,
            attempts: job.attempts,
          },
        }),
        prisma.jobLog.create({
          data: { jobId: job.id, level: 'ERROR', message: `Job moved to DLQ after ${job.attempts} attempts`, meta: { error: errorMessage } },
        }),
      ]);
    }
  } finally {
    activeJobs--;
  }
}

// ── Main Poll Loop ────────────────────────────────────────────────────────────
async function pollLoop() {
  while (!isShuttingDown) {
    try {
      if (activeJobs < CONCURRENCY) {
        const job = await claimNextJob();
        if (job) {
          // Fire-and-forget — don't await so we can claim more jobs
          processJob(job).catch((err) =>
            logger.error('Unhandled error in processJob', { error: err })
          );
        }
      }
    } catch (err) {
      logger.error('Poll loop error', { error: err });
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Wait for active jobs to drain before exiting
  logger.info('Draining active jobs...');
  while (activeJobs > 0) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// ── Entry Point ───────────────────────────────────────────────────────────────
async function main() {
  await prisma.$connect();
  workerId = await registerWorker();

  // Heartbeat loop
  const heartbeatTimer = setInterval(async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      logger.error('Heartbeat failed', { error: err });
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    isShuttingDown = true;
    clearInterval(heartbeatTimer);
    await prisma.worker.update({ where: { id: workerId }, data: { status: 'OFFLINE' } });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info(`Worker started (concurrency=${CONCURRENCY}, poll=${POLL_INTERVAL_MS}ms)`);
  await pollLoop();

  await prisma.$disconnect();
  logger.info('Worker stopped cleanly');
}

main().catch((err) => {
  logger.error('Fatal worker error', { error: err });
  process.exit(1);
});
