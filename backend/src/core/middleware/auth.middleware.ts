import { Response, NextFunction } from 'express';
import { verifyToken } from '../../auth/auth.service';
import type { AuthRequest, TokenPayload } from '../../auth/auth.types';

/**
 * Middleware that verifies the JWT access token from the
 * `Authorization: Bearer <token>` header and attaches the
 * decoded payload to `req.user`.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload: TokenPayload = verifyToken(token);

    if (payload.type !== 'access') {
      res.status(401).json({ message: 'Invalid token type' });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
