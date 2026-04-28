import { api } from './client';
import type { Sound } from '../../shared/types';

interface SoundsResponse { sounds: Sound[] }
interface SoundResponse  { sound: Sound }

export async function listSounds(campaignId: number): Promise<Sound[]> {
  const data = await api<SoundsResponse>(`/soundboard/campaign/${campaignId}`);
  return data.sounds;
}

export async function createSound(
  campaignId: number,
  body: { name: string; url: string; icon?: string | null; volume?: number },
): Promise<Sound> {
  const data = await api<SoundResponse>(`/soundboard/campaign/${campaignId}`, {
    method: 'POST',
    body,
  });
  return data.sound;
}

export async function updateSound(
  id: number,
  body: { name?: string; url?: string; icon?: string | null; volume?: number; show_in_popup?: boolean },
): Promise<Sound> {
  const data = await api<SoundResponse>(`/soundboard/${id}`, {
    method: 'PUT',
    body,
  });
  return data.sound;
}

export async function deleteSound(id: number): Promise<void> {
  await api<{ message: string }>(`/soundboard/${id}`, { method: 'DELETE' });
}
