import { api } from './client';
import type { Effect } from '../../shared/types';

interface EffectsResponse { effects: Effect[] }
interface EffectResponse  { effect: Effect }

export async function listEffects(campaignId: number): Promise<Effect[]> {
  const data = await api<EffectsResponse>(`/effects/campaign/${campaignId}`);
  return data.effects;
}

export async function getEffect(id: number): Promise<Effect> {
  const data = await api<EffectResponse>(`/effects/${id}`);
  return data.effect;
}

export async function createEffect(campaignId: number, body: Partial<Effect>): Promise<Effect> {
  const data = await api<EffectResponse>(`/effects/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.effect;
}

export async function updateEffect(id: number, body: Partial<Effect>): Promise<Effect> {
  const data = await api<EffectResponse>(`/effects/${id}`, {
    method: 'PUT', body,
  });
  return data.effect;
}

export async function deleteEffect(id: number): Promise<void> {
  await api(`/effects/${id}`, { method: 'DELETE' });
}
