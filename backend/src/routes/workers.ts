import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/workers — list active workers
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        _count: { select: { executions: true } },
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    // Mark stale workers (no heartbeat in 30s)
    const STALE_MS = parseInt(process.env.WORKER_STALE_THRESHOLD_MS || '30000');
    const enriched = workers.map((w) => ({
      ...w,
      isStale: Date.now() - new Date(w.lastHeartbeat).getTime() > STALE_MS,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// POST /api/workers/register — called by worker process on startup
router.post('/register', async (req: any, res: any, next: any) => {
  try {
    const { hostname, pid, concurrency, metadata } = req.body;
    const worker = await prisma.worker.create({
      data: { hostname, pid, concurrency: concurrency ?? 5, metadata, status: 'IDLE' },
    });
    res.status(201).json({ success: true, data: worker });
  } catch (err) {
    next(err);
  }
});

// POST /api/workers/:id/heartbeat
router.post('/:id/heartbeat', async (req: any, res: any, next: any) => {
  try {
    const { currentJobs, memoryMb, cpuPercent } = req.body;
    const [worker] = await prisma.$transaction([
      prisma.worker.update({
        where: { id: req.params.id },
        data: { lastHeartbeat: new Date(), currentJobs: currentJobs ?? 0, status: currentJobs > 0 ? 'BUSY' : 'IDLE' },
      }),
      prisma.workerHeartbeat.create({
        data: { workerId: req.params.id, currentJobs: currentJobs ?? 0, memoryMb, cpuPercent },
      }),
    ]);
    res.json({ success: true, data: worker });
  } catch (err) {
    next(err);
  }
});

// POST /api/workers/:id/deregister
router.post('/:id/deregister', async (req: any, res: any, next: any) => {
  try {
    await prisma.worker.update({
      where: { id: req.params.id },
      data: { status: 'OFFLINE' },
    });
    res.json({ success: true, data: { message: 'Worker offline' } });
  } catch (err) {
    next(err);
  }
});

export default router;
