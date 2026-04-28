import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import type { AuthRequest, LoginBody, RegisterBody } from './auth.types';

/* ── POST /api/auth/register ── */
export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, tokens } = await authService.register(req.body as RegisterBody);

    // Set refresh token as httpOnly cookie
    setRefreshCookie(res, tokens.refreshToken);

    res.status(201).json({
      user,
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/auth/login ── */
export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, tokens } = await authService.login(req.body as LoginBody);

    setRefreshCookie(res, tokens.refreshToken);

    res.json({
      user,
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/auth/refresh ── */
export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    const { user, tokens } = await authService.refresh(token || '');

    setRefreshCookie(res, tokens.refreshToken);

    res.json({
      user,
      accessToken: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/auth/logout ── */
export function logoutHandler(_req: Request, res: Response) {
  res.clearCookie('refreshToken', cookieOpts());
  res.json({ message: 'Logged out' });
}

/* ── GET /api/auth/me ── */
export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthRequest;
    const user = await authService.me(authReq.user!.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/* ── Cookie helpers ── */
function cookieOpts() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // 'none' is required for cross-site fetch (Vercel → Render). Must pair with secure:true.
    // Fall back to 'lax' in dev so cookies work without HTTPS.
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, cookieOpts());
}
