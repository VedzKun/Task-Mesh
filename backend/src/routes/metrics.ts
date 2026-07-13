import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/metrics/overview — global system health
router.get('/overview', async (req: any, res: any, next: any) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const [
      totalJobs, jobsByStatus, activeWorkers,
      throughputHour, throughputDay,
      avgDuration, failureRate,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.worker.count({ where: { status: { in: ['IDLE', 'BUSY'] } } }),
      prisma.jobExecution.count({ where: { startedAt: { gte: oneHourAgo } } }),
      prisma.jobExecution.count({ where: { startedAt: { gte: oneDayAgo } } }),
      prisma.jobExecution.aggregate({ _avg: { durationMs: true }, where: { status: 'SUCCEEDED' } }),
      prisma.jobExecution.groupBy({ by: ['status'], _count: { id: true }, where: { startedAt: { gte: oneDayAgo } } }),
    ]);

    const statusMap: Record<string, number> = {};
    jobsByStatus.forEach((s) => (statusMap[s.status] = s._count.id));

    const failureCount = failureRate.find((f) => f.status === 'FAILED')?._count.id ?? 0;
    const totalToday = failureRate.reduce((a, b) => a + b._count.id, 0);
    const failureRatePct = totalToday > 0 ? (failureCount / totalToday) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalJobs,
        jobsByStatus: statusMap,
        activeWorkers,
        throughput: { lastHour: throughputHour, lastDay: throughputDay },
        avgDurationMs: avgDuration._avg.durationMs,
        failureRatePercent: parseFloat(failureRatePct.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/metrics/throughput — time-series data (5-min buckets for last 6h)
router.get('/throughput', async (req: any, res: any, next: any) => {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);
    const executions = await prisma.jobExecution.findMany({
      where: { startedAt: { gte: sixHoursAgo } },
      select: { startedAt: true, status: true },
    });

    // Group into 5-minute buckets
    const buckets: Record<string, { succeeded: number; failed: number }> = {};
    for (const e of executions) {
      const ts = new Date(e.startedAt);
      ts.setSeconds(0, 0);
      ts.setMinutes(Math.floor(ts.getMinutes() / 5) * 5);
      const key = ts.toISOString();
      if (!buckets[key]) buckets[key] = { succeeded: 0, failed: 0 };
      if (e.status === 'SUCCEEDED') buckets[key].succeeded++;
      else if (e.status === 'FAILED') buckets[key].failed++;
    }

    const series = Object.entries(buckets)
      .map(([time, counts]) => ({ time, ...counts }))
      .sort((a, b) => a.time.localeCompare(b.time));

    res.json({ success: true, data: series });
  } catch (err) {
    next(err);
  }
});

// GET /api/metrics/dlq — DLQ entries
router.get('/dlq', async (req: any, res: any, next: any) => {
  try {
    const dlq = await prisma.deadLetterQueue.findMany({
      where: { resolvedAt: null },
      include: { job: { select: { name: true, queueId: true } } },
      orderBy: { failedAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: dlq });
  } catch (err) {
    next(err);
  }
});

export default router;
