import { api } from './client';
import type { Ability } from '../../shared/types';

interface AbilitiesResponse { abilities: Ability[] }
interface AbilityResponse  { ability: Ability }

export async function listAbilities(campaignId: number): Promise<Ability[]> {
  const data = await api<AbilitiesResponse>(`/abilities/campaign/${campaignId}`);
  return data.abilities;
}

export async function listAbilitiesByOwner(
  ownerType: 'char' | 'creature',
  ownerId: number,
): Promise<Ability[]> {
  const data = await api<AbilitiesResponse>(`/abilities/owner/${ownerType}/${ownerId}`);
  return data.abilities;
}

export async function getAbility(id: number): Promise<Ability> {
  const data = await api<AbilityResponse>(`/abilities/${id}`);
  return data.ability;
}

export async function createAbility(campaignId: number, body: Partial<Ability>): Promise<Ability> {
  const data = await api<AbilityResponse>(`/abilities/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.ability;
}

export async function updateAbility(id: number, body: Partial<Ability>): Promise<Ability> {
  const data = await api<AbilityResponse>(`/abilities/${id}`, {
    method: 'PUT', body,
  });
  return data.ability;
}

export async function deleteAbility(id: number): Promise<void> {
  await api(`/abilities/${id}`, { method: 'DELETE' });
}
