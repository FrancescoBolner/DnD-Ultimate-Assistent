import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import * as usersService from '../modules/users/users.service';
import type {
  RegisterBody,
  LoginBody,
  TokenPair,
  TokenPayload,
  SafeUser,
} from './auth.types';

const SALT_ROUNDS = 12;

/* ────────────────────────────────────────────
   Token helpers
   ──────────────────────────────────────────── */

function signAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES } as jwt.SignOptions,
  );
}

function signRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES } as jwt.SignOptions,
  );
}

function generateTokens(userId: number, email: string): TokenPair {
  const base = { userId, email };
  return {
    accessToken: signAccessToken(base),
    refreshToken: signRefreshToken(base),
  };
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

/* ────────────────────────────────────────────
   Register
   ──────────────────────────────────────────── */

export async function register(
  body: RegisterBody,
): Promise<{ user: SafeUser; tokens: TokenPair }> {
  const { email, username, password } = body;

  // Validate
  if (!email || !username || !password) {
    throw Object.assign(new Error('Email, username and password are required'), { status: 400 });
  }
  if (password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }

  // Check duplicates
  if (await usersService.findByEmail(email)) {
    throw Object.assign(new Error('Email already in use'), { status: 409 });
  }
  if (await usersService.findByUsername(username)) {
    throw Object.assign(new Error('Username already taken'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await usersService.createUser(email, username, passwordHash);
  const tokens = generateTokens(user.id, user.email);

  return { user, tokens };
}

/* ────────────────────────────────────────────
   Login
   ──────────────────────────────────────────── */

export async function login(
  body: LoginBody,
): Promise<{ user: SafeUser; tokens: TokenPair }> {
  const { identifier, password } = body;

  if (!identifier || !password) {
    throw Object.assign(new Error('Email/username and password are required'), { status: 400 });
  }

  const row = await usersService.findByEmailOrUsername(identifier);
  if (!row || !row.is_active) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  await usersService.updateLastLogin(row.id);

  const user: SafeUser = {
    id: row.id,
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    is_admin: row.is_admin,
  };

  const tokens = generateTokens(user.id, user.email);
  return { user, tokens };
}

/* ────────────────────────────────────────────
   Refresh token
   ──────────────────────────────────────────── */

export async function refresh(
  refreshToken: string,
): Promise<{ user: SafeUser; tokens: TokenPair }> {
  if (!refreshToken) {
    throw Object.assign(new Error('No refresh token'), { status: 401 });
  }

  let payload: TokenPayload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Token is not a refresh token'), { status: 401 });
  }

  const user = await usersService.getSafeUser(payload.userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 401 });
  }

  const tokens = generateTokens(user.id, user.email);
  return { user, tokens };
}

/* ────────────────────────────────────────────
   Get current session (from access token)
   ──────────────────────────────────────────── */

export async function me(userId: number): Promise<SafeUser> {
  const user = await usersService.getSafeUser(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  return user;
}
