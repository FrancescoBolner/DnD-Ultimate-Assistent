import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthRequest } from '../../auth/auth.types';
import * as usersService from './users.service';

/* ── PUT /api/users/me ── */
export async function updateMeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { username, avatar, password, newPassword } = req.body as {
      username?: string;
      avatar?: string;
      password?: string;
      newPassword?: string;
    };

    const updateData: { username?: string; avatar?: string; passwordHash?: string } = {};

    if (username?.trim()) updateData.username = username.trim();
    if (avatar !== undefined) updateData.avatar = avatar;

    // Password change: requires current password + new password
    if (newPassword) {
      if (!password) {
        res.status(400).json({ message: 'Current password required to change password' });
        return;
      }
      const userRow = await usersService.findById(userId);
      if (!userRow) { res.status(404).json({ message: 'User not found' }); return; }

      const valid = await bcrypt.compare(password, userRow.password_hash);
      if (!valid) {
        res.status(401).json({ message: 'Current password is incorrect' });
        return;
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const user = await usersService.updateUser(userId, updateData);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/* ── DELETE /api/users/me ── */
export async function deleteMeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { confirmUsername } = req.body as { confirmUsername?: string };

    // Fetch user to compare username
    const userRow = await usersService.findById(userId);
    if (!userRow) { res.status(404).json({ message: 'User not found' }); return; }

    if (!confirmUsername || confirmUsername !== userRow.username) {
      res.status(400).json({ message: 'Type your username exactly to confirm account deletion' });
      return;
    }

    await usersService.deleteUser(userId);
    // Clear the refreshToken cookie so the client is fully logged out
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}
