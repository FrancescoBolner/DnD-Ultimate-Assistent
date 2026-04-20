import { api } from './client';

export interface ScreenData {
  id: number;
  campaign_id: number;
  name: string;
  target: 'dm' | 'player';
  layout?: Record<string, unknown>;
  is_active: boolean;
}

interface ScreensResponse { screens: ScreenData[] }
interface ScreenResponse  { screen: ScreenData }

export async function listScreens(campaignId: number): Promise<ScreenData[]> {
  const data = await api<ScreensResponse>(`/screens/campaign/${campaignId}`);
  return data.screens;
}

export async function getScreen(id: number): Promise<ScreenData> {
  const data = await api<ScreenResponse>(`/screens/${id}`);
  return data.screen;
}

export async function createScreen(campaignId: number, body: Partial<ScreenData>): Promise<ScreenData> {
  const data = await api<ScreenResponse>(`/screens/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.screen;
}

export async function updateScreen(id: number, body: Partial<ScreenData>): Promise<ScreenData> {
  const data = await api<ScreenResponse>(`/screens/${id}`, {
    method: 'PUT', body,
  });
  return data.screen;
}

export async function deleteScreen(id: number): Promise<void> {
  await api(`/screens/${id}`, { method: 'DELETE' });
}

export async function getActiveScreen(campaignId: number): Promise<ScreenData | null> {
  try {
    const data = await api<ScreenResponse>(`/screens/campaign/${campaignId}/active`);
    return data.screen ?? null;
  } catch {
    return null;
  }
}

export async function pushScreen(
  campaignId: number,
  layout: Record<string, unknown>,
): Promise<ScreenData> {
  const data = await api<ScreenResponse>(`/screens/campaign/${campaignId}/push`, {
    method: 'POST', body: { layout },
  });
  return data.screen;
}

export async function stopScreen(campaignId: number): Promise<void> {
  await api(`/screens/campaign/${campaignId}/active`, { method: 'DELETE' });
}

// ─── Screen presets ──────────────────────────────────────────

export interface ScreenPresetData {
  id: number;
  campaign_id: number;
  name: string;
  layout: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ScreenPresetsResponse { presets: ScreenPresetData[] }
interface ScreenPresetResponse  { preset:  ScreenPresetData }

export async function listScreenPresets(campaignId: number): Promise<ScreenPresetData[]> {
  const data = await api<ScreenPresetsResponse>(`/screens/campaign/${campaignId}/presets`);
  return data.presets;
}

export async function saveScreenPreset(
  campaignId: number, name: string, layout: Record<string, unknown>,
): Promise<ScreenPresetData> {
  const data = await api<ScreenPresetResponse>(`/screens/campaign/${campaignId}/presets`, {
    method: 'POST', body: { name, layout },
  });
  return data.preset;
}

export async function updateScreenPreset(
  campaignId: number, id: number,
  data: { name?: string; layout?: Record<string, unknown> },
): Promise<ScreenPresetData> {
  const resp = await api<ScreenPresetResponse>(`/screens/campaign/${campaignId}/presets/${id}`, {
    method: 'PUT', body: data,
  });
  return resp.preset;
}

export async function deleteScreenPreset(campaignId: number, id: number): Promise<void> {
  await api(`/screens/campaign/${campaignId}/presets/${id}`, { method: 'DELETE' });
}
