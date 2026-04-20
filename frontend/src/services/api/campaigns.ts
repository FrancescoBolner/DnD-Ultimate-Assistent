import { api } from './client';
import type { Campaign, CampaignMember, CampaignPlayer, Character } from '../../shared/types';

/* ── Response shapes ── */
interface CampaignsResponse   { campaigns: Campaign[] }
interface CampaignResponse    { campaign: Campaign }
interface MembersResponse     { members: CampaignMember[] }
interface PlayersResponse     { players: CampaignPlayer[] }
interface CharactersResponse  { characters: Character[] }
interface CharacterResponse   { character: Character }

/* ── Campaign CRUD ── */

export async function listCampaigns(): Promise<Campaign[]> {
  const data = await api<CampaignsResponse>('/campaigns');
  return data.campaigns;
}

export async function createCampaign(name: string, description: string): Promise<Campaign> {
  const data = await api<CampaignResponse>('/campaigns', {
    method: 'POST',
    body: { name, description },
  });
  return data.campaign;
}

export async function joinCampaign(inviteCode: string): Promise<Campaign> {
  const data = await api<CampaignResponse>('/campaigns/join', {
    method: 'POST',
    body: { invite_code: inviteCode },
  });
  return data.campaign;
}

export async function leaveCampaign(campaignId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/leave`, { method: 'DELETE' });
}

export async function updateCampaign(
  campaignId: number,
  body: Partial<{ name: string; description: string; status: string; image: string }>,
): Promise<Campaign> {
  const data = await api<CampaignResponse>(`/campaigns/${campaignId}`, {
    method: 'PUT', body,
  });
  return data.campaign;
}

export async function deleteCampaign(campaignId: number): Promise<void> {
  await api(`/campaigns/${campaignId}`, { method: 'DELETE' });
}

/* ── Campaign data ── */

export async function getCampaignMembers(campaignId: number): Promise<CampaignMember[]> {
  const data = await api<MembersResponse>(`/campaigns/${campaignId}/members`);
  return data.members;
}

export async function getCampaignPlayers(campaignId: number): Promise<CampaignPlayer[]> {
  const data = await api<PlayersResponse>(`/campaigns/${campaignId}/players`);
  return data.players;
}

export async function acceptPlayer(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}/accept`, { method: 'POST' });
}

export async function rejectPlayer(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}/reject`, { method: 'DELETE' });
}

export async function kickPlayer(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}`, { method: 'DELETE' });
}

export async function banPlayer(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}/ban`, { method: 'POST' });
}

export async function unbanPlayer(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}/unban`, { method: 'POST' });
}

export async function deletePlayerEntry(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}/entry`, { method: 'DELETE' });
}

export async function reinvitePlayer(campaignId: number, userId: number): Promise<void> {
  await api(`/campaigns/${campaignId}/members/${userId}/reinvite`, { method: 'POST' });
}

export async function getCampaignCharacters(campaignId: number): Promise<Character[]> {
  const data = await api<CharactersResponse>(`/campaigns/${campaignId}/characters`);
  return data.characters;
}

/* ── Characters ── */

export interface CharacterCreateData {
  name: string;
  race?: string;
  class?: string;
  level?: number;
  stats?: Record<string, number>;
  hp_max?: number;
  hp_current?: number;
  hp_temp?: number;
  ac?: number;
  speed?: number;
  image?: string;
  backstory?: string;
}

export async function createCharacter(
  campaignId: number,
  data: CharacterCreateData,
): Promise<Character> {
  const res = await api<CharacterResponse>(`/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: data,
  });
  return res.character;
}

export async function assignCharacter(characterId: number): Promise<void> {
  await api(`/characters/${characterId}/assign`, { method: 'PATCH' });
}

export async function setCharacterPlayer(
  characterId: number,
  userId: number | null,
): Promise<void> {
  await api(`/characters/${characterId}/assign-player`, {
    method: 'PATCH',
    body: { user_id: userId },
  });
}

export async function updateCharacter(
  characterId: number,
  body: Partial<CharacterCreateData>,
): Promise<Character> {
  const data = await api<CharacterResponse>(`/characters/${characterId}`, {
    method: 'PUT', body,
  });
  return data.character;
}

export async function deleteCharacter(characterId: number): Promise<void> {
  await api(`/characters/${characterId}`, { method: 'DELETE' });
}
