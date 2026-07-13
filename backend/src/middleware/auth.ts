import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';
import { createHash } from 'crypto';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string };
      project?: { id: string; name: string; userId: string };
    }
  }
}

// ── JWT Auth Middleware ────────────────────────────────────────────────────────
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Missing auth token');

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    req.user = { id: payload.userId, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

// ── API Key Auth Middleware (for job submission from external services) ────────
export const authenticateApiKey = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) throw new UnauthorizedError('Missing API key');

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const project = await prisma.project.findUnique({
      where: { apiKeyHash: keyHash },
      select: { id: true, name: true, userId: true },
    });

    if (!project) throw new UnauthorizedError('Invalid API key');
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

// ── Admin-only Guard ──────────────────────────────────────────────────────────
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'ADMIN') {
    next(new ForbiddenError('Admin access required'));
    return;
  }
  next();
};
