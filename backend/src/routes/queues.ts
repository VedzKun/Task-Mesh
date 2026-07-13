import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { JobStatus } from '@prisma/client';

const router = Router({ mergeParams: true });
router.use(authenticate);

// Ownership check helper
const assertQueueOwnership = async (queueId: string, userId: string) => {
  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    include: { project: { select: { userId: true } } },
  });
  if (!queue) throw new NotFoundError('Queue');
  if (queue.project.userId !== userId) throw new ForbiddenError();
  return queue;
};

// GET /api/projects/:projectId/queues
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const { projectId } = req.params;
    const queues = await prisma.queue.findMany({
      where: { projectId },
      include: {
        retryPolicy: true,
        _count: { select: { jobs: true } },
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });

    // Enrich with per-status counts
    const enriched = await Promise.all(
      queues.map(async (q) => {
        const statusCounts = await prisma.job.groupBy({
          by: ['status'],
          where: { queueId: q.id },
          _count: { id: true },
        });
        const counts: Record<string, number> = {};
        statusCounts.forEach((s) => (counts[s.status] = s._count.id));
        return { ...q, statusCounts: counts };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/queues
router.post(
  '/',
  [
    body('name').trim().notEmpty(),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('concurrencyLimit').optional().isInt({ min: 1, max: 100 }),
    body('rateLimitPerMin').optional().isInt({ min: 1 }),
    body('retryPolicyId').optional().isUUID(),
  ],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      const queue = await prisma.queue.create({
        data: {
          projectId: req.params.projectId,
          name: req.body.name,
          description: req.body.description,
          priority: req.body.priority ?? 5,
          concurrencyLimit: req.body.concurrencyLimit ?? 5,
          rateLimitPerMin: req.body.rateLimitPerMin,
          retryPolicyId: req.body.retryPolicyId,
        },
      });
      res.status(201).json({ success: true, data: queue });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:projectId/queues/:id
router.get('/:id', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    const queue = await assertQueueOwnership(req.params.id, req.user.id);
    res.json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/queues/:id
router.patch(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      await assertQueueOwnership(req.params.id, req.user.id);
      const allowed = ['name', 'description', 'priority', 'concurrencyLimit', 'rateLimitPerMin', 'retryPolicyId'];
      const data: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      }
      const queue = await prisma.queue.update({ where: { id: req.params.id }, data });
      res.json({ success: true, data: queue });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/projects/:projectId/queues/:id/pause
router.post('/:id/pause', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    await assertQueueOwnership(req.params.id, req.user.id);
    const queue = await prisma.queue.update({ where: { id: req.params.id }, data: { isPaused: true } });
    res.json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/queues/:id/resume
router.post('/:id/resume', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    await assertQueueOwnership(req.params.id, req.user.id);
    const queue = await prisma.queue.update({ where: { id: req.params.id }, data: { isPaused: false } });
    res.json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/queues/:id
router.delete('/:id', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    await assertQueueOwnership(req.params.id, req.user.id);
    await prisma.queue.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Queue deleted' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/queues/:id/stats
router.get('/:id/stats', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    await assertQueueOwnership(req.params.id, req.user.id);
    const queueId = req.params.id;

    const [statusCounts, throughput, avgDuration] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        where: { queueId },
        _count: { id: true },
      }),
      prisma.jobExecution.count({
        where: { job: { queueId }, startedAt: { gte: new Date(Date.now() - 3600000) } },
      }),
      prisma.jobExecution.aggregate({
        where: { job: { queueId }, status: 'SUCCEEDED' },
        _avg: { durationMs: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        queueId,
        statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
        throughputLastHour: throughput,
        avgDurationMs: avgDuration._avg.durationMs,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
