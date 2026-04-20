import { api } from './client';
import type { Combat, CombatParticipant } from '../../shared/types';

interface CombatsResponse      { combats: Combat[] }
interface CombatResponse       { combat: Combat | null }
interface ParticipantsResponse { participants: CombatParticipant[] }
interface ParticipantResponse  { participant: CombatParticipant }
interface StartCombatResponse  { combat: Combat; participants: CombatParticipant[] }

export interface StartCombatParticipantInput {
  char_id?: number;
  creature_id?: number;
  initiative?: number;
  hp_current?: number;
}

/* ── Combat CRUD ── */

export async function listCombats(campaignId: number): Promise<Combat[]> {
  const data = await api<CombatsResponse>(`/combat/campaign/${campaignId}`);
  return data.combats;
}

export async function getActiveCombat(campaignId: number): Promise<Combat | null> {
  const data = await api<CombatResponse>(`/combat/campaign/${campaignId}/active`);
  return data.combat;
}

export async function getCombat(id: number): Promise<Combat> {
  const data = await api<{ combat: Combat }>(`/combat/${id}`);
  return data.combat;
}

export async function createCombat(campaignId: number, name?: string): Promise<Combat> {
  const data = await api<{ combat: Combat }>(`/combat/campaign/${campaignId}`, {
    method: 'POST', body: { name },
  });
  return data.combat;
}

export async function startCombat(
  campaignId: number,
  body: { name?: string; participants: StartCombatParticipantInput[] },
): Promise<StartCombatResponse> {
  return api<StartCombatResponse>(`/combat/campaign/${campaignId}/start`, {
    method: 'POST', body,
  });
}

export async function updateCombat(
  id: number,
  body: Partial<{ name: string; round: number; status: string; current_participant_id: number | null }>,
): Promise<Combat> {
  const data = await api<{ combat: Combat }>(`/combat/${id}`, {
    method: 'PUT', body,
  });
  return data.combat;
}

export async function deleteCombat(id: number): Promise<void> {
  await api(`/combat/${id}`, { method: 'DELETE' });
}

export async function nextTurn(id: number): Promise<StartCombatResponse> {
  return api<StartCombatResponse>(`/combat/${id}/next`, { method: 'POST' });
}

/* ── Participants ── */

export async function getParticipants(combatId: number): Promise<CombatParticipant[]> {
  const data = await api<ParticipantsResponse>(`/combat/${combatId}/participants`);
  return data.participants;
}

export async function addParticipant(
  combatId: number,
  body: { char_id?: number; creature_id?: number; initiative?: number; hp_current?: number },
): Promise<CombatParticipant> {
  const data = await api<ParticipantResponse>(`/combat/${combatId}/participants`, {
    method: 'POST', body,
  });
  return data.participant;
}

export async function updateParticipant(
  combatId: number,
  participantId: number,
  body: Partial<{ initiative: number; hp_current: number; hp_temp: number; is_active: boolean; notes: string }>,
): Promise<void> {
  await api(`/combat/${combatId}/participants/${participantId}`, {
    method: 'PUT', body,
  });
}

export async function removeParticipant(combatId: number, participantId: number): Promise<void> {
  await api(`/combat/${combatId}/participants/${participantId}`, { method: 'DELETE' });
}

export async function applyParticipantEffect(
  combatId: number,
  participantId: number,
  body: { name: string; turns_left: number; source_effect_id?: number | null; is_custom?: boolean },
): Promise<CombatParticipant> {
  const data = await api<ParticipantResponse>(`/combat/${combatId}/participants/${participantId}/effects`, {
    method: 'POST', body,
  });
  return data.participant;
}

export async function updateParticipantEffectTurns(
  combatId: number,
  participantId: number,
  effectId: string,
  turns_left: number,
): Promise<CombatParticipant> {
  const data = await api<ParticipantResponse>(`/combat/${combatId}/participants/${participantId}/effects/${effectId}`, {
    method: 'PUT', body: { turns_left },
  });
  return data.participant;
}

export async function removeParticipantEffect(
  combatId: number,
  participantId: number,
  effectId: string,
): Promise<CombatParticipant> {
  const data = await api<ParticipantResponse>(`/combat/${combatId}/participants/${participantId}/effects/${effectId}`, {
    method: 'DELETE',
  });
  return data.participant;
}
