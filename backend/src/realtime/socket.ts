import http from 'http';
import { Server } from 'socket.io';
import type { Application } from 'express';
import { env } from '../config/env';

let io: Server;

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  const explicitAllowed = env.CORS_ORIGIN
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (explicitAllowed.includes(origin)) return true;

  const lanOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i;
  return lanOrigin.test(origin);
}

/**
 * Attach Socket.IO to the Express app and return the http.Server.
 * The `io` singleton is exported separately so services can emit events.
 */
export function createSocketServer(app: Application): http.Server {
  const httpServer = http.createServer(app);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (isAllowedOrigin(origin)) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Client sends { campaignId } to subscribe to a campaign room
    socket.on('join:campaign', (campaignId: number) => {
      socket.join(`campaign:${campaignId}`);
    });

    socket.on('leave:campaign', (campaignId: number) => {
      socket.leave(`campaign:${campaignId}`);
    });

    // DM emits live view state directly — relay to others without a DB round-trip
    socket.on('map:viewState:live', (data: {
      campaignId: number;
      mapId: number;
      viewState: { originX: number; originY: number; scale: number };
    }) => {
      socket.to(`campaign:${data.campaignId}`).emit('map:viewState', data);
    });

    // Entity dragged — relay position to other clients without persisting
    socket.on('map:entity:move:live', (data: {
      campaignId: number;
      mapId: number;
      entityId: number;
      x: number;
      y: number;
    }) => {
      socket.to(`campaign:${data.campaignId}`).emit('map:entity:move:live', data);
    });

    // Soundboard — relay play trigger to all OTHER clients in the room
    socket.on('soundboard:play:trigger', (data: {
      campaignId: number;
      soundId: number;
      volume: number;
    }) => {
      socket.to(`campaign:${data.campaignId}`).emit('soundboard:play', data);
    });

    // Soundboard — relay stop trigger to all OTHER clients in the room
    socket.on('soundboard:stop:trigger', (data: {
      campaignId: number;
      soundId: number;
    }) => {
      socket.to(`campaign:${data.campaignId}`).emit('soundboard:stop', data);
    });
  });

  return httpServer;
}

/** Emit a character update to every client in the campaign room. */
export function emitCharacterUpdated(
  campaignId: number,
  character: {
    id: number;
    name: string;
    race: string | null;
    class: string | null;
    level: number;
    stats: Record<string, number> | null;
    hp_max: number;
    hp_current: number;
    hp_temp: number;
    ac: number;
    speed: number;
    image: string | null;
    backstory: string | null;
  },
): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('character:updated', character);
}

/** Emit a creature update to every client in the campaign room. */
export function emitCreatureUpdated(
  campaignId: number,
  creature: {
    id: number;
    name: string;
    type: string;
    cr: string | null;
    size: string;
    stats: Record<string, number> | null;
    hp_max: number;
    hp_current: number;
    hp_temp: number;
    ac: number;
    speed: number;
    image: string | null;
    sheet_image: string | null;
    notes: string | null;
    tags: string[] | null;
    race: string | null;
    religion: string | null;
  },
): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('creature:updated', creature);
}

/** Broadcast a generic combat state change for the campaign room. */
export function emitCombatUpdated(campaignId: number): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('combat:updated', { campaignId });
}

/** Broadcast a screen layout push to all clients in the campaign room. */
export function emitScreenUpdated(campaignId: number, layout: unknown): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('screen:updated', { campaignId, layout });
}

/** Broadcast that the map list changed (create/update/delete). */
export function emitMapUpdated(campaignId: number): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('map:updated', { campaignId });
}

/** Broadcast the DM's camera view state for a specific map. */
export function emitMapViewState(
  campaignId: number,
  mapId: number,
  viewState: { originX: number; originY: number; scale: number },
): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('map:viewState', { campaignId, mapId, viewState });
}

/** Broadcast that map entities changed (placed/moved/removed tokens). */
export function emitMapEntitiesUpdated(campaignId: number, mapId: number): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('map:entitiesUpdated', { campaignId, mapId });
}

/** Broadcast that range marks changed (added/moved/removed). */
export function emitMapRangeMarksUpdated(campaignId: number, mapId: number): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('map:rangeMarksUpdated', { campaignId, mapId });
}

/** Broadcast that the soundboard sound list changed (create/update/delete). */
export function emitSoundboardUpdated(campaignId: number): void {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit('soundboard:updated', { campaignId });
}
