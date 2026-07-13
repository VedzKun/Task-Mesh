import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Cron scheduler service.
 * Responsibilities:
 *  1. Promote SCHEDULED jobs whose run_at has passed → QUEUED
 *  2. Enqueue next occurrence of CRON jobs after they complete
 *  3. Mark stale (zombie) claims as failed if a worker died
 */
export function startCronScheduler() {
  // Run every 5 seconds — promote scheduled jobs
  cron.schedule('*/5 * * * * *', async () => {
    try {
      // Promote delayed/scheduled jobs that are now ready
      const promoted = await prisma.job.updateMany({
        where: {
          status: 'SCHEDULED',
          runAt: { lte: new Date() },
        },
        data: { status: 'QUEUED' },
      });
      if (promoted.count > 0) {
        logger.debug(`Promoted ${promoted.count} scheduled jobs to QUEUED`);
      }
    } catch (err) {
      logger.error('Cron: error promoting scheduled jobs', { error: err });
    }
  });

  // Run every 10 seconds — reclaim zombie jobs
  cron.schedule('*/10 * * * * *', async () => {
    try {
      const CLAIM_TIMEOUT_MS = 120_000; // 2 minutes
      const cutoff = new Date(Date.now() - CLAIM_TIMEOUT_MS);
      const zombies = await prisma.job.updateMany({
        where: {
          status: { in: ['CLAIMED', 'RUNNING'] },
          lockedAt: { lte: cutoff },
        },
        data: {
          status: 'QUEUED',
          lockedAt: null,
          lockedBy: null,
        },
      });
      if (zombies.count > 0) {
        logger.warn(`Reclaimed ${zombies.count} zombie job(s)`);
      }
    } catch (err) {
      logger.error('Cron: error reclaiming zombie jobs', { error: err });
    }
  });

  // Run every minute — re-queue next occurrence of CRON-type completed jobs
  cron.schedule('* * * * *', async () => {
    try {
      const parser = await import('node-cron');
      const completedCronJobs = await prisma.job.findMany({
        where: { jobType: 'CRON', status: 'COMPLETED', cronExpression: { not: null } },
      });

      for (const job of completedCronJobs) {
        if (!job.cronExpression) continue;
        const isValid = cron.validate(job.cronExpression);
        if (!isValid) continue;

        // Re-enqueue with reset attempt count
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'QUEUED', attempts: 0, runAt: new Date(), completedAt: null },
        });
      }
    } catch (err) {
      logger.error('Cron: error re-queuing cron jobs', { error: err });
    }
  });

  logger.info('Cron scheduler started');
}
