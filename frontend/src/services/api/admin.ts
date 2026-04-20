import { api, getAccessToken } from './client';

/* ── Types ── */
export interface AdminUser {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AdminCampaign {
  id: number;
  name: string;
  description?: string;
  dm_id: number;
  dm_username: string;
  status: string;
  player_count: number;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  active_users: number;
  total_campaigns: number;
  active_campaigns: number;
  total_characters: number;
}

/* ── API calls ── */

export async function getStats(): Promise<PlatformStats> {
  const res = await api<{ stats: PlatformStats }>('/admin/stats');
  return res.stats;
}

export async function getUsers(page = 1, limit = 50): Promise<{ users: AdminUser[]; total: number }> {
  return api(`/admin/users?page=${page}&limit=${limit}`);
}

export async function toggleUserActive(userId: number, isActive: boolean): Promise<void> {
  await api(`/admin/users/${userId}/active`, { method: 'PATCH', body: { is_active: isActive } });
}

export async function toggleUserAdmin(userId: number, isAdmin: boolean): Promise<void> {
  await api(`/admin/users/${userId}/admin`, { method: 'PATCH', body: { is_admin: isAdmin } });
}

export async function getCampaigns(page = 1, limit = 50): Promise<{ campaigns: AdminCampaign[]; total: number }> {
  return api(`/admin/campaigns?page=${page}&limit=${limit}`);
}

export interface AdminImage {
  path: string;
  url: string;
  name: string;
  folder: string;
  ext: string;
  type: 'image' | 'audio' | 'other';
}

export async function getImages(): Promise<AdminImage[]> {
  const res = await api<{ images: AdminImage[] }>('/admin/images');
  return res.images;
}

/* ── Database Export / Import ── */

export async function exportDb(): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`http://localhost:3000/api/admin/db/export`, {
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Export failed');
  }

  const blob = await res.blob();
  const date = new Date().toISOString().split('T')[0];
  const filename = `dnd-backup-${date}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importDb(
  data: Record<string, unknown[]>,
  strategy: 'replace' | 'ignore',
): Promise<{ imported: number; tables: string[] }> {
  return api('/admin/db/import', { method: 'POST', body: { data, strategy } });
}

