import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '../lib/errors';

export const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: 'path' in e ? String(e.path) : 'unknown',
      message: e.msg,
    }));
    next(new ValidationError(formatted));
    return;
  }
  next();
};
