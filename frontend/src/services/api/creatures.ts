import { api } from './client';
import type { Creature } from '../../shared/types';

interface CreaturesResponse { creatures: Creature[] }
interface CreatureResponse  { creature: Creature }

export async function listCreatures(campaignId: number): Promise<Creature[]> {
  const data = await api<CreaturesResponse>(`/creatures/campaign/${campaignId}`);
  return data.creatures;
}

export async function getCreature(id: number): Promise<Creature> {
  const data = await api<CreatureResponse>(`/creatures/${id}`);
  return data.creature;
}

export async function createCreature(campaignId: number, body: Partial<Creature>): Promise<Creature> {
  const data = await api<CreatureResponse>(`/creatures/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.creature;
}

export async function updateCreature(id: number, body: Partial<Creature>): Promise<Creature> {
  const data = await api<CreatureResponse>(`/creatures/${id}`, {
    method: 'PUT', body,
  });
  return data.creature;
}

export async function deleteCreature(id: number): Promise<void> {
  await api(`/creatures/${id}`, { method: 'DELETE' });
}
