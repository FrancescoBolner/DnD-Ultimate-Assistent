import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../config/db';
import { env } from '../config/env';
import * as usersService from '../modules/users/users.service';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
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

/** Generate tokens for a user without any password check — admin-only impersonation. */
export function impersonateTokens(userId: number, email: string): { tokens: TokenPair } {
  return { tokens: generateTokens(userId, email) };
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

/* ────────────────────────────────────────────
   Forgot / Reset password
   ──────────────────────────────────────────── */

function createMailTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

/**
 * Always returns successfully to avoid leaking whether an email exists.
 * If the email is found, sends a reset link; otherwise silently no-ops.
 */
export async function forgotPassword(email: string): Promise<void> {
  if (!email) return;

  const user = await usersService.findByEmail(email.toLowerCase().trim());
  if (!user) return; // silent — don't reveal whether email exists

  // Invalidate any previous unused tokens for this user
  await pool.execute(
    'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE',
    [user.id],
  );

  // Generate a cryptographically random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.execute<ResultSetHeader>(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, tokenHash, expiresAt],
  );

  const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;

  if (!env.SMTP_HOST) {
    // Dev fallback: log to console instead of sending email
    console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const transport = createMailTransport();
  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'D&D Assistant — Password Reset',
      text: `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Click the link below to reset your password. It expires in <strong>1 hour</strong>.</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>
             <p>If you did not request this, you can safely ignore this email.</p>`,
    });
    console.log(`[MAIL] Reset email sent to ${email}`);
  } catch (err) {
    // Log the real SMTP error so it shows in the terminal, but don't leak it to the client
    console.error('[MAIL] Failed to send reset email:', err);
    throw err; // re-throw so the handler returns 500 instead of silently failing
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw Object.assign(new Error('Token and new password are required'), { status: 400 });
  }
  if (newPassword.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, expires_at, used
     FROM password_reset_tokens
     WHERE token_hash = ? AND used = FALSE AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );

  if (!rows.length) {
    throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  }

  const row = rows[0];

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id]);
  await pool.execute('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [row.id]);
}
