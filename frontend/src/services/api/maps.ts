import { api } from './client';
import type { MapRecord, MapEntity, MapRangeMark, MapViewState } from '../../shared/types';

interface MapsResponse      { maps: MapRecord[] }
interface MapResponse       { map: MapRecord }
interface EntitiesResponse  { entities: MapEntity[] }
interface EntityResponse    { entity: MapEntity }
interface RangeMarksResponse { rangeMarks: MapRangeMark[] }
interface RangeMarkResponse  { rangeMark: MapRangeMark }

/* ── Map CRUD ── */

export async function listMaps(campaignId: number): Promise<MapRecord[]> {
  const data = await api<MapsResponse>(`/maps/campaign/${campaignId}`);
  return data.maps;
}

export async function getMap(id: number): Promise<MapRecord> {
  const data = await api<MapResponse>(`/maps/${id}`);
  return data.map;
}

export async function createMap(campaignId: number, body: Partial<MapRecord>): Promise<MapRecord> {
  const data = await api<MapResponse>(`/maps/campaign/${campaignId}`, {
    method: 'POST', body,
  });
  return data.map;
}

export async function updateMap(id: number, body: Partial<MapRecord>): Promise<MapRecord> {
  const data = await api<MapResponse>(`/maps/${id}`, {
    method: 'PUT', body,
  });
  return data.map;
}

export async function deleteMap(id: number): Promise<void> {
  await api(`/maps/${id}`, { method: 'DELETE' });
}

/* ── View State ── */

export async function updateViewState(id: number, vs: MapViewState): Promise<void> {
  await api(`/maps/${id}/view-state`, { method: 'PUT', body: vs });
}

/* ── Entities ── */

export async function listEntities(mapId: number): Promise<MapEntity[]> {
  const data = await api<EntitiesResponse>(`/maps/${mapId}/entities`);
  return data.entities;
}

export async function createEntity(
  mapId: number,
  body: Omit<MapEntity, 'id' | 'map_id'>,
): Promise<MapEntity> {
  const data = await api<EntityResponse>(`/maps/${mapId}/entities`, {
    method: 'POST', body,
  });
  return data.entity;
}

export async function updateEntity(
  mapId: number,
  entityId: number,
  body: Partial<Pick<MapEntity, 'x' | 'y' | 'scale' | 'parent_path' | 'label'>>,
): Promise<MapEntity> {
  const data = await api<EntityResponse>(`/maps/${mapId}/entities/${entityId}`, {
    method: 'PUT', body,
  });
  return data.entity;
}

export async function deleteEntity(mapId: number, entityId: number): Promise<void> {
  await api(`/maps/${mapId}/entities/${entityId}`, { method: 'DELETE' });
}

/* ── Range Marks ── */

export async function listRangeMarks(mapId: number): Promise<MapRangeMark[]> {
  const data = await api<RangeMarksResponse>(`/maps/${mapId}/range-marks`);
  return data.rangeMarks;
}

export async function createRangeMark(
  mapId: number,
  body: Omit<MapRangeMark, 'id' | 'map_id'>,
): Promise<MapRangeMark> {
  const data = await api<RangeMarkResponse>(`/maps/${mapId}/range-marks`, {
    method: 'POST', body,
  });
  return data.rangeMark;
}

export async function updateRangeMark(
  mapId: number,
  markId: number,
  body: { x?: number; y?: number; x2?: number | null; y2?: number | null; x3?: number | null; y3?: number | null },
): Promise<MapRangeMark> {
  const data = await api<RangeMarkResponse>(`/maps/${mapId}/range-marks/${markId}`, {
    method: 'PUT', body,
  });
  return data.rangeMark;
}

export async function deleteRangeMark(mapId: number, markId: number): Promise<void> {
  await api(`/maps/${mapId}/range-marks/${markId}`, { method: 'DELETE' });
}
