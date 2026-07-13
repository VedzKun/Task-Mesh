import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate, authenticateApiKey } from '../middleware/auth';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors';
import { JobStatus, JobType } from '@prisma/client';

const router = Router({ mergeParams: true });

// Dual auth: dashboard (JWT) or API (API key)
const dualAuth = [
  (req: any, res: any, next: any) => {
    if (req.headers['x-api-key']) return authenticateApiKey(req, res, next);
    authenticate(req, res, next);
  },
];

router.use(dualAuth);

const PAGE_SIZE = 20;

// GET /api/jobs — list with filter, pagination
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || PAGE_SIZE);
    const { status, queueId, batchId, search } = req.query as Record<string, string>;

    const where: any = {};
    if (status) where.status = status as JobStatus;
    if (queueId) where.queueId = queueId;
    if (batchId) where.batchId = batchId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { queue: { select: { name: true, projectId: true } } },
        orderBy: [{ priority: 'desc' }, { runAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs — create a job (immediate, delayed, scheduled, cron, batch)
router.post(
  '/',
  [
    body('queueId').isUUID(),
    body('name').trim().notEmpty(),
    body('payload').optional().isObject(),
    body('jobType').optional().isIn(Object.values(JobType)),
    body('runAt').optional().isISO8601(),
    body('cronExpression').optional().isString(),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('maxRetries').optional().isInt({ min: 0, max: 25 }),
    body('idempotencyKey').optional().isString(),
    body('dependsOnJobId').optional().isUUID(),
    body('batchId').optional().isString(),
  ],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      const {
        queueId, name, payload = {}, jobType = 'IMMEDIATE', runAt,
        cronExpression, priority = 5, maxRetries = 3, idempotencyKey,
        dependsOnJobId, batchId, retryPolicyId,
      } = req.body;

      // Idempotency check
      if (idempotencyKey) {
        const existing = await prisma.job.findUnique({ where: { idempotencyKey } });
        if (existing) {
          res.json({ success: true, data: existing, idempotent: true });
          return;
        }
      }

      const queue = await prisma.queue.findUnique({ where: { id: queueId } });
      if (!queue) throw new NotFoundError('Queue');

      const effectiveRunAt = runAt ? new Date(runAt) : new Date();
      const status: JobStatus = jobType === 'IMMEDIATE' ? 'QUEUED' : 'SCHEDULED';
      const nextRunAt = cronExpression ? new Date() : undefined;

      const job = await prisma.job.create({
        data: {
          queueId,
          name,
          payload,
          status,
          jobType: jobType as JobType,
          runAt: effectiveRunAt,
          cronExpression,
          nextRunAt,
          priority,
          maxRetries,
          retryPolicyId,
          idempotencyKey,
          dependsOnJobId,
          batchId,
        },
      });

      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/jobs/batch — submit multiple jobs atomically
router.post('/batch', async (req: any, res: any, next: any) => {
  try {
    const { jobs, batchId } = req.body as {
      jobs: Array<{ queueId: string; name: string; payload?: object; priority?: number; runAt?: string }>;
      batchId?: string;
    };
    if (!jobs?.length) {
      res.status(400).json({ success: false, error: { message: 'No jobs provided' } });
      return;
    }

    const resolvedBatchId = batchId || `batch_${Date.now()}`;
    const created = await prisma.$transaction(
      jobs.map((j) =>
        prisma.job.create({
          data: {
            queueId: j.queueId,
            name: j.name,
            payload: j.payload ?? {},
            status: 'QUEUED',
            jobType: 'BATCH',
            runAt: j.runAt ? new Date(j.runAt) : new Date(),
            priority: j.priority ?? 5,
            batchId: resolvedBatchId,
          },
        })
      )
    );

    res.status(201).json({ success: true, data: { batchId: resolvedBatchId, count: created.length, jobs: created } });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id
router.get('/:id', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        executions: { orderBy: { startedAt: 'desc' } },
        logs: { orderBy: { timestamp: 'desc' }, take: 100 },
        dlqEntry: true,
        queue: { select: { name: true, projectId: true } },
      },
    });
    if (!job) throw new NotFoundError('Job');
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/:id/cancel
router.post('/:id/cancel', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new NotFoundError('Job');
    if (!['QUEUED', 'SCHEDULED'].includes(job.status)) {
      res.status(409).json({ success: false, error: { message: `Cannot cancel a job in ${job.status} status` } });
      return;
    }
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/:id/retry — manually retry a failed/DLQ job
router.post('/:id/retry', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new NotFoundError('Job');
    if (!['FAILED', 'DLQ', 'CANCELLED'].includes(job.status)) {
      res.status(409).json({ success: false, error: { message: 'Only FAILED, DLQ, or CANCELLED jobs can be retried' } });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (job.status === 'DLQ') {
        await tx.deadLetterQueue.update({
          where: { jobId: job.id },
          data: { resolvedAt: new Date() },
        });
      }
      return tx.job.update({
        where: { id: job.id },
        data: { status: 'QUEUED', attempts: 0, runAt: new Date(), lockedAt: null, lockedBy: null },
      });
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
