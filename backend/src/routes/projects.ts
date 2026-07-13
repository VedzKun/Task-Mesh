import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { NotFoundError, ForbiddenError } from '../lib/errors';

const router = Router();

// All project routes require JWT auth
router.use(authenticate);

// Helper: verify project belongs to user
const getOwnedProject = async (projectId: string, userId: string) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project');
  if (project.userId !== userId) throw new ForbiddenError();
  return project;
};

// GET /api/projects
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: { _count: { select: { queues: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
router.post(
  '/',
  [body('name').trim().notEmpty(), body('description').optional().trim()],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      const rawKey = `tmk_${randomBytes(24).toString('hex')}`;
      const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');
      const apiKeyPrefix = rawKey.slice(0, 12);

      const project = await prisma.project.create({
        data: {
          userId: req.user.id,
          name: req.body.name,
          description: req.body.description,
          apiKeyHash,
          apiKeyPrefix,
        },
      });

      // Return raw key once — never stored again
      res.status(201).json({ success: true, data: { ...project, apiKey: rawKey } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:id
router.get('/:id', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    const project = await getOwnedProject(req.params.id, req.user.id);
    const stats = await prisma.queue.findMany({
      where: { projectId: project.id },
      include: { _count: { select: { jobs: true } } },
    });
    res.json({ success: true, data: { ...project, queues: stats } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:id
router.patch(
  '/:id',
  [param('id').isUUID(), body('name').optional().trim().notEmpty()],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      await getOwnedProject(req.params.id, req.user.id);
      const updated = await prisma.project.update({
        where: { id: req.params.id },
        data: { name: req.body.name, description: req.body.description },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:id
router.delete('/:id', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    await getOwnedProject(req.params.id, req.user.id);
    // Cascade deletes queues → jobs → executions via DB constraints
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Project deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/rotate-key
router.post('/:id/rotate-key', param('id').isUUID(), validate, async (req: any, res: any, next: any) => {
  try {
    await getOwnedProject(req.params.id, req.user.id);
    const rawKey = `tmk_${randomBytes(24).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKeyPrefix = rawKey.slice(0, 12);
    await prisma.project.update({
      where: { id: req.params.id },
      data: { apiKeyHash, apiKeyPrefix },
    });
    res.json({ success: true, data: { apiKey: rawKey, apiKeyPrefix } });
  } catch (err) {
    next(err);
  }
});

export default router;
