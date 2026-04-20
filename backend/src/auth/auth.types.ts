import { Request } from 'express';

/* ── Row returned by the DB ── */
export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  avatar: string | null;
  is_admin: boolean;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

/* ── Public user (never expose password_hash) ── */
export interface SafeUser {
  id: number;
  email: string;
  username: string;
  avatar: string | null;
  is_admin: boolean;
}

/* ── JWT payload ── */
export interface TokenPayload {
  userId: number;
  email: string;
  type: 'access' | 'refresh';
}

/* ── Request body shapes ── */
export interface RegisterBody {
  email: string;
  username: string;
  password: string;
}

export interface LoginBody {
  /** Can be an email address or a username */
  identifier: string;
  password: string;
}

/* ── Token pair returned to the client ── */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/* ── Extend Express Request so middleware can attach user ── */
export interface AuthRequest extends Request {
  user?: TokenPayload;
}
