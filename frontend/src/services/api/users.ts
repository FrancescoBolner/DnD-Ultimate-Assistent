import { api } from './client';
import type { User } from '../../shared/types';

interface UserResponse { user: User }

export async function updateProfile(data: {
  username?: string;
  avatar?: string;
  password?: string;
  newPassword?: string;
}): Promise<User> {
  const res = await api<UserResponse>('/users/me', {
    method: 'PUT',
    body: data,
  });
  return res.user;
}

export async function deleteAccount(confirmText: string): Promise<void> {
  await api<{ message: string }>('/users/me', {
    method: 'DELETE',
    body: { confirmText },
  });
}
