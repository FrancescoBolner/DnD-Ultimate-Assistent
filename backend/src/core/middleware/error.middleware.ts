import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

interface HttpError extends Error {
  status?: number;
}

/**
 * Central error handler – catches errors thrown / passed via next().
 * Place this AFTER all routes.
 *
 * Supports both legacy { status } errors and the new AppError class.
 */
export function errorHandler(err: HttpError | AppError, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof AppError ? err.status : (err.status || 500);
  const message = status === 500 ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({ message });
}
