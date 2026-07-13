import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { ConflictError, UnauthorizedError } from '../lib/errors';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      const { email, password, name } = req.body;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictError('Email already registered');

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, passwordHash, name },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
      );

      res.status(201).json({ success: true, data: { user, token } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req: any, res: any, next: any) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new UnauthorizedError('Invalid credentials');

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedError('Invalid credentials');

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
      );

      res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
          token,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req: any, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
