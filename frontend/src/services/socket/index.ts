import { io, Socket } from 'socket.io-client';

/* ── Types ─────────────────────────────────────────────────── */
export interface CharacterHpPayload {
  id:         number;
  name:       string;
  race?:      string | null;
  class?:     string | null;
  level:      number;
  stats?:     Record<string, number> | null;
  hp_max:     number;
  hp_current: number;
  hp_temp:    number;
  ac:         number;
  speed:      number;
  image?:     string | null;
  backstory?: string | null;
}

export interface CreatureHpPayload {
  id:        number;
  name:      string;
  type:      string;
  cr?:       string | null;
  size:      string;
  stats?:    Record<string, number> | null;
  hp_max:    number;
  hp_current: number;
  hp_temp:   number;
  ac:        number;
  speed:     number;
  image?:    string | null;
  notes?:    string | null;
  tags?:     string[] | null;
  race?:     string | null;
  religion?: string | null;
}

export interface CombatUpdatedPayload {
  campaignId: number;
}

/* ── Singleton ──────────────────────────────────────────────── */
function resolveSocketUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv.replace('/api', '');
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  return `${protocol}//${host}:3000`;
}

const SOCKET_URL = resolveSocketUrl();

export const socket: Socket = io(SOCKET_URL, {
  autoConnect:       true,
  withCredentials:   true,
  reconnectionDelay: 1000,
});

/* ── Campaign room helpers ──────────────────────────────────── */
export function joinCampaign(campaignId: number): void {
  socket.emit('join:campaign', campaignId);
}

export function leaveCampaign(campaignId: number): void {
  socket.emit('leave:campaign', campaignId);
}

/* ── Typed subscriber ───────────────────────────────────────── */
export function onCharacterUpdated(
  listener: (payload: CharacterHpPayload) => void,
): () => void {
  socket.on('character:updated', listener);
  return () => socket.off('character:updated', listener);
}

export function onCreatureUpdated(
  listener: (payload: CreatureHpPayload) => void,
): () => void {
  socket.on('creature:updated', listener);
  return () => socket.off('creature:updated', listener);
}

export function onCombatUpdated(
  listener: (payload: CombatUpdatedPayload) => void,
): () => void {
  socket.on('combat:updated', listener);
  return () => socket.off('combat:updated', listener);
}

export interface ScreenUpdatedPayload {
  campaignId: number;
  layout: unknown;
}

export function onScreenUpdated(
  listener: (payload: ScreenUpdatedPayload) => void,
): () => void {
  socket.on('screen:updated', listener);
  return () => socket.off('screen:updated', listener);
}

/* ── Map events ─────────────────────────────────────────────── */

export interface MapUpdatedPayload {
  campaignId: number;
}

export interface MapViewStatePayload {
  campaignId: number;
  mapId: number;
  viewState: { originX: number; originY: number; scale: number };
}

export interface MapEntitiesUpdatedPayload {
  campaignId: number;
  mapId: number;
}

export function onMapUpdated(
  listener: (payload: MapUpdatedPayload) => void,
): () => void {
  socket.on('map:updated', listener);
  return () => socket.off('map:updated', listener);
}

export function onMapViewState(
  listener: (payload: MapViewStatePayload) => void,
): () => void {
  socket.on('map:viewState', listener);
  return () => socket.off('map:viewState', listener);
}

export function onMapEntitiesUpdated(
  listener: (payload: MapEntitiesUpdatedPayload) => void,
): () => void {
  socket.on('map:entitiesUpdated', listener);
  return () => socket.off('map:entitiesUpdated', listener);
}

/**
 * Emit the DM's view state live over socket — no HTTP, no DB round-trip.
 * The server relays this to everyone else in the campaign room.
 */
export function emitMapViewStateLive(
  campaignId: number,
  mapId: number,
  viewState: { originX: number; originY: number; scale: number },
): void {
  socket.emit('map:viewState:live', { campaignId, mapId, viewState });
}

export interface EntityMoveLivePayload {
  campaignId: number;
  mapId: number;
  entityId: number;
  x: number;
  y: number;
}

/** Emit a real-time entity position while dragging — relayed by server, not persisted. */
export function emitEntityMoveLive(payload: EntityMoveLivePayload): void {
  socket.emit('map:entity:move:live', payload);
}

export function onEntityMoved(
  listener: (payload: EntityMoveLivePayload) => void,
): () => void {
  socket.on('map:entity:move:live', listener);
  return () => socket.off('map:entity:move:live', listener);
}

export interface MapRangeMarksUpdatedPayload {
  campaignId: number;
  mapId: number;
}

export function onMapRangeMarksUpdated(
  listener: (payload: MapRangeMarksUpdatedPayload) => void,
): () => void {
  socket.on('map:rangeMarksUpdated', listener);
  return () => socket.off('map:rangeMarksUpdated', listener);
}

/* ── Soundboard events ──────────────────────────────────────── */

export interface SoundboardUpdatedPayload { campaignId: number }
export interface SoundboardPlayPayload    { campaignId: number; soundId: number; volume: number }
export interface SoundboardStopPayload    { campaignId: number; soundId: number }

/** Listen for soundboard CRUD changes (list refresh). */
export function onSoundboardUpdated(
  listener: (payload: SoundboardUpdatedPayload) => void,
): () => void {
  socket.on('soundboard:updated', listener);
  return () => socket.off('soundboard:updated', listener);
}

/** Listen for a remote play event (relayed from another client). */
export function onSoundboardPlay(
  listener: (payload: SoundboardPlayPayload) => void,
): () => void {
  socket.on('soundboard:play', listener);
  return () => socket.off('soundboard:play', listener);
}

/** Listen for a remote stop event (relayed from another client). */
export function onSoundboardStop(
  listener: (payload: SoundboardStopPayload) => void,
): () => void {
  socket.on('soundboard:stop', listener);
  return () => socket.off('soundboard:stop', listener);
}

/** Emit a play trigger — server relays to all OTHER clients in the campaign room. */
export function emitSoundPlayTrigger(campaignId: number, soundId: number, volume: number): void {
  socket.emit('soundboard:play:trigger', { campaignId, soundId, volume });
}

/** Emit a stop trigger — server relays to all OTHER clients in the campaign room. */
export function emitSoundStopTrigger(campaignId: number, soundId: number): void {
  socket.emit('soundboard:stop:trigger', { campaignId, soundId });
}
