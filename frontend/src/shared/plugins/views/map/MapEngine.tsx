import { useRef, useEffect, useCallback } from 'react';
import type { MapData, MapImageNode, MapGeneralMark, MapSound, MapEntity, MapRangeMark, RangeMarkShape, MapViewState, Character, Creature } from '../../../types';
import { getApiOrigin } from '../../../../services/api/client';

/* ────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────── */

interface RuntimeNode extends MapImageNode {
  img?: HTMLImageElement;
  imgFailed?: boolean;
  children?: RuntimeNode[];
}

interface RuntimeMark {
  node: MapGeneralMark | RuntimeNode;
  isGeneral: boolean;
  parentNode: RuntimeNode | null;
  screenX?: number;
  screenY?: number;
}

interface RuntimeSound extends MapSound {
  audio?: HTMLAudioElement;
  playing?: boolean;
}

export interface MapEngineProps {
  mapData: MapData | null;
  viewState: MapViewState | null;
  onViewStateChange?: (vs: MapViewState) => void;
  entities: MapEntity[];
  characters: Character[];
  creatures: Creature[];
  showMarks?: boolean;
  showMarkInfo?: boolean;
  showSounds?: boolean;
  volumeEnabled?: boolean;
  onEntityClick?: (entity: MapEntity) => void;
  onEntityRightClick?: (entity: MapEntity) => void;
  onEntityDrag?: (entityId: number, x: number, y: number) => void;
  onEntityDragEnd?: (entityId: number, x: number, y: number) => void;
  onCanvasClick?: (worldX: number, worldY: number, nodePath?: string) => void;
  /** When set, clicking the canvas in "pick node" mode returns the node at that point */
  onPickNode?: (path: string, name: string) => void;
  pickingNodeMode?: boolean;
  interactive?: boolean;
  /** Base URL for resolving relative asset paths (default: backend origin) */
  assetBase?: string;
  /**
   * When set, the camera is clamped so the viewport never shows world coordinates
   * outside these bounds. Used to prevent players from seeing DM-only content.
   */
  clampBounds?: { x: number; y: number; width: number; height: number };
  /** Range marks to draw */
  rangeMarks?: MapRangeMark[];
  /** Called when a range mark is right-clicked (for deletion) */
  onRangeMarkRightClick?: (mark: MapRangeMark) => void;
  /** Called when a range mark drag ends */
  onRangeMarkDragEnd?: (markId: number, x: number, y: number, x2: number | null, y2: number | null, x3: number | null, y3: number | null) => void;
  /** Preview state while placing a new range mark */
  rangePlacingPreview?: { shape: RangeMarkShape; p1: { x: number; y: number }; p2: { x: number; y: number } | null; cursor: { x: number; y: number } | null };
  /** Color for the placement preview ring (matches the selected mark color) */
  rangePlacingColor?: string;
  /** Fired on every mouse move over the canvas with world coordinates (not fired during drag) */
  onCanvasMouseMove?: (worldX: number, worldY: number) => void;
}

/* ────────────────────────────────────────────────────────
   Asset URL resolution
   ──────────────────────────────────────────────────────── */

function resolveAssetUrl(url: string, assetBase: string, gallery?: unknown[]): string {
  if (!url) return url;
  if (url.startsWith('gallery:')) {
    const galleryId = url.substring(8);
    if (!gallery) return url;
    const item = (gallery as { id: string; content: string }[]).find(g => g.id === galleryId);
    return item ? item.content : url;
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${assetBase}/${url}`;
}

/* ────────────────────────────────────────────────────────
   Node tree helpers
   ──────────────────────────────────────────────────────── */

function getNodeByPath(config: RuntimeNode[], path: string): RuntimeNode | null {
  const indices = path.split(',').map(Number);
  let node = config[indices[0]];
  if (!node) return null;
  for (let i = 1; i < indices.length; i++) {
    if (!node.children) return null;
    node = node.children[indices[i]];
    if (!node) return null;
  }
  return node;
}

function loadImages(node: RuntimeNode, assetBase: string, gallery?: unknown[]): void {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  node.imgFailed = false;
  img.onerror = () => { node.imgFailed = true; };
  img.onload = () => { node.imgFailed = false; };
  img.src = resolveAssetUrl(node.src, assetBase, gallery);
  node.img = img;
  if (node.children) {
    node.children.forEach(child => loadImages(child as RuntimeNode, assetBase, gallery));
  }
}

/** Find deepest visible node that contains world point (wx, wy) */
function findNodeAtWorld(
  config: RuntimeNode[],
  wx: number, wy: number,
  camScale: number,
): { path: string; name: string } | null {
  let bestPath = '';
  let bestName = '';
  let bestAppearScale = -1;

  function check(node: RuntimeNode, pathArr: number[]) {
    if (camScale < node.appearScale) return;
    if (node.img && node.img.complete && !node.imgFailed && node.img.naturalWidth > 0) {
      const hw = (node.img.width * node.size) / 2;
      const hh = (node.img.height * node.size) / 2;
      if (wx >= node.x - hw && wx <= node.x + hw && wy >= node.y - hh && wy <= node.y + hh) {
        if (node.appearScale > bestAppearScale) {
          bestAppearScale = node.appearScale;
          bestPath = pathArr.join(',');
          bestName = node.name || '';
        }
      }
    }
    if (node.children) {
      node.children.forEach((child, i) => check(child as RuntimeNode, [...pathArr, i]));
    }
  }

  config.forEach((node, i) => check(node, [i]));
  return bestAppearScale >= 0 ? { path: bestPath, name: bestName } : null;
}

/* ────────────────────────────────────────────────────────
   Entity display helpers
   ──────────────────────────────────────────────────────── */

function getEntityColor(entity: MapEntity, creatures: Creature[]): string {
  if (entity.entity_type === 'character')    return '#4fc3f7';
  if (entity.entity_type === 'custom_npc')   return '#81c784';
  if (entity.entity_type === 'custom_enemy') return '#ef5350';
  const creature = creatures.find(c => c.id === entity.entity_id);
  if (!creature) return '#bdbdbd';
  switch (creature.type) {
    case 'npc':   return '#81c784';
    case 'enemy': return '#ef5350';
    case 'ally':  return '#ffb74d';
    case 'beast': return '#ba68c8';
    default:      return '#bdbdbd';
  }
}

function getEntityFillColor(entity: MapEntity): string {
  if (entity.entity_type === 'custom_npc')   return '#2e7d32';
  if (entity.entity_type === 'custom_enemy') return '#b71c1c';
  return '#333';
}

function getEntityImage(entity: MapEntity, characters: Character[], creatures: Creature[]): string | undefined {
  if (entity.entity_type === 'character') {
    return characters.find(c => c.id === entity.entity_id)?.image;
  }
  return creatures.find(c => c.id === entity.entity_id)?.image;
}

function getEntityName(entity: MapEntity, characters: Character[], creatures: Creature[]): string {
  if (entity.label) return entity.label;
  if (entity.entity_type === 'character') {
    return characters.find(c => c.id === entity.entity_id)?.name ?? '?';
  }
  return creatures.find(c => c.id === entity.entity_id)?.name ?? '?';
}

/* ────────────────────────────────────────────────────────
   Range mark hit testing
   ──────────────────────────────────────────────────────── */

/** Minimum distance from point (px,py) to segment (ax,ay)→(bx,by). */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Returns true if world point (wx, wy) is on the border of the given range mark. */
function hitRangeMark(rm: MapRangeMark, wx: number, wy: number, scale: number): boolean {
  const hitR = 12 / scale;
  const shape = (rm.shape ?? 'circle') as RangeMarkShape;

  if (shape === 'point') {
    const dist = Math.hypot(wx - rm.x, wy - rm.y);
    return dist <= hitR * 2;
  }

  if (shape === 'circle') {
    const dist = Math.hypot(wx - rm.x, wy - rm.y);
    const sr = rm.radius * scale;
    return Math.abs(dist - rm.radius) <= hitR || (sr < 20 && dist <= rm.radius + hitR);
  }

  if (shape === 'line') {
    if (rm.x2 === null || rm.y2 === null) return false;
    return distToSegment(wx, wy, rm.x, rm.y, rm.x2, rm.y2) <= hitR;
  }

  if (shape === 'cylinder') {
    if (rm.x2 === null || rm.y2 === null || rm.x3 === null || rm.y3 === null) return false;
    const ax = rm.x2 - rm.x, ay = rm.y2 - rm.y;
    const len = Math.hypot(ax, ay);
    if (len < 0.001) return false;
    const nx = ax / len, ny = ay / len;
    const px = -ny, py = nx;
    const hw = Math.abs((rm.x3 - rm.x) * px + (rm.y3 - rm.y) * py);
    if (hw < 0.001) return false;
    const c0 = { x: rm.x  + px * hw, y: rm.y  + py * hw };
    const c1 = { x: rm.x2 + px * hw, y: rm.y2 + py * hw };
    const c2 = { x: rm.x2 - px * hw, y: rm.y2 - py * hw };
    const c3 = { x: rm.x  - px * hw, y: rm.y  - py * hw };
    return (
      distToSegment(wx, wy, c0.x, c0.y, c1.x, c1.y) <= hitR ||
      distToSegment(wx, wy, c1.x, c1.y, c2.x, c2.y) <= hitR ||
      distToSegment(wx, wy, c2.x, c2.y, c3.x, c3.y) <= hitR ||
      distToSegment(wx, wy, c3.x, c3.y, c0.x, c0.y) <= hitR
    );
  }

  if (shape === 'cone') {
    if (rm.x2 === null || rm.y2 === null || rm.x3 === null || rm.y3 === null) return false;
    const baseR = Math.hypot(rm.x3 - rm.x2, rm.y3 - rm.y2);
    const ax = rm.x2 - rm.x, ay = rm.y2 - rm.y;
    const len = Math.hypot(ax, ay);
    if (len < 0.001 || baseR < 0.001) return false;
    const nx = ax / len, ny = ay / len;
    const px = -ny, py = nx;
    const bl = { x: rm.x2 + px * baseR, y: rm.y2 + py * baseR };
    const br = { x: rm.x2 - px * baseR, y: rm.y2 - py * baseR };
    return (
      distToSegment(wx, wy, rm.x, rm.y, bl.x, bl.y) <= hitR ||
      distToSegment(wx, wy, rm.x, rm.y, br.x, br.y) <= hitR ||
      distToSegment(wx, wy, bl.x, bl.y, br.x, br.y) <= hitR
    );
  }

  return false;
}

/* ────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────── */

export default function MapEngine({
  mapData,
  viewState,
  onViewStateChange,
  entities,
  characters,
  creatures,
  showMarks = true,
  showMarkInfo = true,
  showSounds = false,
  volumeEnabled = false,
  onEntityClick,
  onEntityRightClick,
  onEntityDrag,
  onEntityDragEnd,
  onCanvasClick,
  onPickNode,
  pickingNodeMode = false,
  interactive = true,
  assetBase,
  clampBounds,
  rangeMarks = [],
  onRangeMarkRightClick,
  onRangeMarkDragEnd,
  rangePlacingPreview,
  rangePlacingColor,
  onCanvasMouseMove,
}: MapEngineProps) {
  const resolvedAssetBase = assetBase ?? getApiOrigin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera state
  const camRef = useRef({ originX: 0, originY: 0, scale: 1 });
  // Runtime data
  const configRef = useRef<RuntimeNode[]>([]);
  const marksRef = useRef<RuntimeMark[]>([]);
  const soundsRef = useRef<RuntimeSound[]>([]);
  // Image cache for entities
  const entityImgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  // Interaction state
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, hasDragged: false });
  const entityDragRef = useRef<{ entityId: number; startWorldX: number; startWorldY: number; origX: number; origY: number; hasMoved: boolean; currentX: number; currentY: number } | null>(null);
  const rangeMarkDragRef = useRef<{
    markId: number;
    startWorldX: number; startWorldY: number;
    origX: number; origY: number;
    origX2: number | null; origY2: number | null;
    origX3: number | null; origY3: number | null;
    hasMoved: boolean;
    currentX: number; currentY: number;
    currentX2: number | null; currentY2: number | null;
    currentX3: number | null; currentY3: number | null;
  } | null>(null);
  const userInteracted = useRef(false);
  const spaceHeldRef = useRef(false);
  // Touch state
  const touchRef = useRef<{
    touches: Record<number, { x: number; y: number }>;
    initialDistance: number;
    initialScale: number;
    startOriginX: number;
    startOriginY: number;
    // Double-tap tracking for entity drag on mobile
    lastTapTime: number;
    lastTapX: number;
    lastTapY: number;
  }>({ touches: {}, initialDistance: 0, initialScale: 1, startOriginX: 0, startOriginY: 0, lastTapTime: 0, lastTapX: 0, lastTapY: 0 });
  // Overlay refs
  const marksOverlayRef = useRef<HTMLDivElement>(null);
  const markInfoRef = useRef<HTMLDivElement>(null);
  // Sound update throttle
  const lastSoundUpdateRef = useRef(0);
  // viewState throttle: trailing timer + timestamp of last emit
  const viewStateSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitTimeRef = useRef(0);
  // Viewport clamping
  const clampBoundsRef = useRef(clampBounds);
  useEffect(() => { clampBoundsRef.current = clampBounds; }, [clampBounds]);
  // Track last synced view state so resizeCanvas can re-apply scale adjustment
  const lastSyncedViewStateRef = useRef<MapViewState | null>(null);
  // Track whether this instance owns view-state (DM) or just receives it (player)
  const onViewStateChangePropRef = useRef(onViewStateChange);
  useEffect(() => { onViewStateChangePropRef.current = onViewStateChange; }, [onViewStateChange]);

  // Stable refs to latest callback versions (for native event listeners)
  const interactiveRef = useRef(interactive);
  const pickingNodeModeRef = useRef(pickingNodeMode);
  const showMarksRef = useRef(showMarks);
  const showMarkInfoRef = useRef(showMarkInfo);
  useEffect(() => { interactiveRef.current = interactive; }, [interactive]);
  useEffect(() => { pickingNodeModeRef.current = pickingNodeMode; }, [pickingNodeMode]);
  useEffect(() => {
    showMarksRef.current = showMarks;
    // Immediately hide the hover popup when marks are toggled off
    if (!showMarks && markInfoRef.current) markInfoRef.current.style.display = 'none';
  }, [showMarks]);
  useEffect(() => {
    showMarkInfoRef.current = showMarkInfo;
    if (!showMarkInfo && markInfoRef.current) markInfoRef.current.style.display = 'none';
  }, [showMarkInfo]);

  // Space key → pan override (skip entity drag while Space is held)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        spaceHeldRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Refs to stable callbacks used by native handlers
  const onPickNodeRef = useRef(onPickNode);
  useEffect(() => { onPickNodeRef.current = onPickNode; }, [onPickNode]);
  const onRangeMarkRightClickRef = useRef(onRangeMarkRightClick);
  useEffect(() => { onRangeMarkRightClickRef.current = onRangeMarkRightClick; }, [onRangeMarkRightClick]);
  const onRangeMarkDragEndRef = useRef(onRangeMarkDragEnd);
  useEffect(() => { onRangeMarkDragEndRef.current = onRangeMarkDragEnd; }, [onRangeMarkDragEnd]);
  const onEntityDragRef = useRef(onEntityDrag);
  useEffect(() => { onEntityDragRef.current = onEntityDrag; }, [onEntityDrag]);
  const onEntityDragEndRef = useRef(onEntityDragEnd);
  useEffect(() => { onEntityDragEndRef.current = onEntityDragEnd; }, [onEntityDragEnd]);
  const entitiesRef = useRef(entities);
  useEffect(() => { entitiesRef.current = entities; }, [entities]);
  const rangeMarksRef = useRef(rangeMarks);
  useEffect(() => { rangeMarksRef.current = rangeMarks; }, [rangeMarks]);
  const rangePlacingPreviewRef = useRef(rangePlacingPreview);
  useEffect(() => { rangePlacingPreviewRef.current = rangePlacingPreview; }, [rangePlacingPreview]);
  const rangePlacingColorRef = useRef(rangePlacingColor);
  useEffect(() => { rangePlacingColorRef.current = rangePlacingColor; }, [rangePlacingColor]);
  const onCanvasMouseMoveRef = useRef(onCanvasMouseMove);
  useEffect(() => { onCanvasMouseMoveRef.current = onCanvasMouseMove; }, [onCanvasMouseMove]);

  // Hit radius for mark hover (screen pixels)
  const MARK_HOVER_R = 18;

  /* ── Coordinate conversions ── */
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current!;
    const { scale, originX, originY } = camRef.current;
    return {
      x: (sx - canvas.width / 2) / scale + originX,
      y: (sy - canvas.height / 2) / scale + originY,
    };
  }, []);

  /**
   * Clamp the camera so the viewport never shows world coordinates outside
   * clampBounds. Mutates camRef in place. No-op when clampBounds is not set.
   */
  const clampCamera = useCallback(() => {
    const cb = clampBoundsRef.current;
    const canvas = canvasRef.current;
    if (!cb || !canvas) return;
    const cam = camRef.current;
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // Minimum scale: the map must always fill the whole viewport
    const minScale = Math.max(canvasW / cb.width, canvasH / cb.height);
    if (cam.scale < minScale) cam.scale = minScale;

    const visHW = canvasW / (2 * cam.scale);
    const visHH = canvasH / (2 * cam.scale);
    const bL = cb.x, bR = cb.x + cb.width;
    const bT = cb.y, bB = cb.y + cb.height;

    // Horizontal: if the map is too narrow to pan, centre it
    if (bR - bL <= 2 * visHW) {
      cam.originX = (bL + bR) / 2;
    } else {
      cam.originX = Math.max(bL + visHW, Math.min(bR - visHW, cam.originX));
    }
    // Vertical: same
    if (bB - bT <= 2 * visHH) {
      cam.originY = (bT + bB) / 2;
    } else {
      cam.originY = Math.max(bT + visHH, Math.min(bB - visHH, cam.originY));
    }
  }, []);
  // Stable ref for use inside native event listeners (wheel, touch)
  const clampCameraRef = useRef(clampCamera);

  /* ── Save view state: throttle 80 ms + trailing 200 ms ── */
  const commitViewState = useCallback(() => {
    const fn = onViewStateChangePropRef.current;
    if (!fn) return;

    const doEmit = () => {
      lastEmitTimeRef.current = Date.now();
      const { originX, originY, scale } = camRef.current;
      const canvas = canvasRef.current;
      fn({
        originX, originY, scale,
        ...(canvas && canvas.width > 0 ? { dmWidth: canvas.width, dmHeight: canvas.height } : {}),
      });
    };

    // Cancel any pending trailing emit
    if (viewStateSaveTimer.current) clearTimeout(viewStateSaveTimer.current);

    // Throttle gate: fire immediately if ≥80 ms have elapsed since last emit
    if (Date.now() - lastEmitTimeRef.current >= 80) {
      doEmit();
    }
    // Always schedule a trailing emit to capture the final resting position
    viewStateSaveTimer.current = setTimeout(doEmit, 200);
  }, []);

  /* ── Draw a node recursively ── */
  const drawNode = useCallback((ctx: CanvasRenderingContext2D, node: RuntimeNode) => {
    const { scale, originX, originY } = camRef.current;
    const canvas = canvasRef.current!;
    const isVisible = scale >= node.appearScale;

    if (isVisible && node.img?.complete && !node.imgFailed && node.img.naturalWidth > 0) {
      const w = node.img.width * node.size * scale;
      const h = node.img.height * node.size * scale;
      const x = canvas.width / 2 + (node.x - originX) * scale - w / 2;
      const y = canvas.height / 2 + (node.y - originY) * scale - h / 2;
      ctx.drawImage(node.img, x, y, w, h);
    }

    if (isVisible && node.children) {
      node.children.forEach(child => drawNode(ctx, child));
    }
  }, []);

  /* ── Draw entities on canvas (world-space scaling) ── */
  const drawEntities = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current!;
    const { scale, originX, originY } = camRef.current;

    for (const ent of entities) {
      // Respect parent_path visibility
      if (ent.parent_path) {
        const parentNode = getNodeByPath(configRef.current, ent.parent_path);
        if (!parentNode || scale < parentNode.appearScale) continue;
      }

      const sx = canvas.width / 2 + (ent.x - originX) * scale;
      const sy = canvas.height / 2 + (ent.y - originY) * scale;
      // Purely world-space radius — scales exactly with zoom, no pixel floor
      const radius = ent.scale * scale;
      if (radius < 1) continue; // skip sub-pixel entities
      const borderColor = getEntityColor(ent, creatures);

      ctx.save();
      // Outer border ring (proportional so size is consistent across zoom levels)
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();

      // Inner clipped circle
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.clip();

      const isCustom = ent.entity_type === 'custom_npc' || ent.entity_type === 'custom_enemy';
      ctx.fillStyle = getEntityFillColor(ent);
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);

      const imgSrc = isCustom ? undefined : getEntityImage(ent, characters, creatures);
      if (imgSrc) {
        const cacheKey = `${ent.entity_type}:${ent.entity_id}`;
        let img = entityImgCache.current.get(cacheKey);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = imgSrc;
          entityImgCache.current.set(cacheKey, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          // "cover" behaviour: scale to fill the circle, centred
          const iw = img.naturalWidth;
          const ih = img.naturalHeight;
          const diameter = radius * 2;
          const scale = Math.max(diameter / iw, diameter / ih);
          const sw = iw * scale;
          const sh = ih * scale;
          ctx.drawImage(img, sx - sw / 2, sy - sh / 2, sw, sh);
        }
      } else if (!isCustom) {
        const name = getEntityName(ent, characters, creatures);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, radius * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.charAt(0).toUpperCase(), sx, sy);
      }
      ctx.restore();

      // Label below token (only when large enough)
      if (radius > 14) {
        const name = getEntityName(ent, characters, creatures);
        ctx.save();
        ctx.font = '11px sans-serif';
        const lw = ctx.measureText(name).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(sx - lw / 2, sy + radius + 4, lw, 16);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(name, sx, sy + radius + 6);
        ctx.restore();
      }
    }
  }, [entities, characters, creatures]);

  /* ── Draw range marks on canvas ── */
  const drawRangeMarks = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current!;
    const { scale, originX, originY } = camRef.current;
    const wx2sx = (wx: number) => canvas.width  / 2 + (wx - originX) * scale;
    const wy2sy = (wy: number) => canvas.height / 2 + (wy - originY) * scale;

    type Pt = { x: number; y: number };

    const drawCircleShape = (cx: number, cy: number, r: number, color: string, alpha: number) => {
      const sr = r * scale;
      if (sr < 1) return;
      const sx = wx2sx(cx), sy = wy2sy(cy);
      ctx.save();
      ctx.globalAlpha = alpha * 0.15;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    const drawLineShape = (p1: Pt, p2: Pt, color: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wx2sx(p1.x), wy2sy(p1.y));
      ctx.lineTo(wx2sx(p2.x), wy2sy(p2.y));
      ctx.stroke();
      ctx.restore();
    };

    const drawRectShape = (p1: Pt, p2: Pt, p3: Pt, color: string, alpha: number) => {
      const ax = p2.x - p1.x, ay = p2.y - p1.y;
      const len = Math.hypot(ax, ay);
      if (len < 0.001) return;
      const nx = ax / len, ny = ay / len;
      const px = -ny, py = nx;
      const hw = Math.abs((p3.x - p1.x) * px + (p3.y - p1.y) * py);
      if (hw < 0.001) return;
      const corners: Pt[] = [
        { x: p1.x + px * hw, y: p1.y + py * hw },
        { x: p2.x + px * hw, y: p2.y + py * hw },
        { x: p2.x - px * hw, y: p2.y - py * hw },
        { x: p1.x - px * hw, y: p1.y - py * hw },
      ];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wx2sx(corners[0].x), wy2sy(corners[0].y));
      for (let i = 1; i < 4; i++) ctx.lineTo(wx2sx(corners[i].x), wy2sy(corners[i].y));
      ctx.closePath();
      ctx.globalAlpha = alpha * 0.15; ctx.fillStyle = color; ctx.fill();
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    };

    const drawConeShape = (p1: Pt, p2: Pt, p3: Pt, color: string, alpha: number) => {
      const baseR = Math.hypot(p3.x - p2.x, p3.y - p2.y);
      const ax = p2.x - p1.x, ay = p2.y - p1.y;
      const len = Math.hypot(ax, ay);
      if (len < 0.001 || baseR < 0.001) return;
      const nx = ax / len, ny = ay / len;
      const px = -ny, py = nx;
      const bl: Pt = { x: p2.x + px * baseR, y: p2.y + py * baseR };
      const br: Pt = { x: p2.x - px * baseR, y: p2.y - py * baseR };
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wx2sx(p1.x), wy2sy(p1.y));
      ctx.lineTo(wx2sx(bl.x), wy2sy(bl.y));
      ctx.lineTo(wx2sx(br.x), wy2sy(br.y));
      ctx.closePath();
      ctx.globalAlpha = alpha * 0.15; ctx.fillStyle = color; ctx.fill();
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    };

    const drawAnchor = (cx: number, cy: number, color: string, alpha: number, arm = 7) => {
      const sx = wx2sx(cx), sy = wy2sy(cy);
      ctx.save();
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy - arm); ctx.lineTo(sx + arm, sy + arm);
      ctx.moveTo(sx + arm, sy - arm); ctx.lineTo(sx - arm, sy + arm);
      ctx.stroke();
      ctx.restore();
    };

    // ── Draw persisted marks ──
    for (const rm of rangeMarksRef.current) {
      if (rm.parent_path) {
        const pn = getNodeByPath(configRef.current, rm.parent_path);
        if (!pn || scale < pn.appearScale) continue;
      }
      const shape = (rm.shape ?? 'circle') as RangeMarkShape;
      const p1: Pt = { x: rm.x, y: rm.y };
      const p2: Pt | null = (rm.x2 !== null && rm.y2 !== null) ? { x: rm.x2, y: rm.y2 } : null;
      const p3: Pt | null = (rm.x3 !== null && rm.y3 !== null) ? { x: rm.x3, y: rm.y3 } : null;
      if      (shape === 'point'    )               drawAnchor(p1.x, p1.y, rm.color, 1, 11);
      else if (shape === 'circle'   )               { drawCircleShape(p1.x, p1.y, rm.radius, rm.color, 1); drawAnchor(p1.x, p1.y, rm.color, 0.7); }
      else if (shape === 'line'     && p2)           { drawLineShape(p1, p2, rm.color, 1); drawAnchor(p1.x, p1.y, rm.color, 0.7); }
      else if (shape === 'cylinder' && p2 && p3)    { drawRectShape(p1, p2, p3, rm.color, 1); drawAnchor(p1.x, p1.y, rm.color, 0.7); }
      else if (shape === 'cone'     && p2 && p3)    { drawConeShape(p1, p2, p3, rm.color, 1); drawAnchor(p1.x, p1.y, rm.color, 0.7); }
    }

    // ── Draw placement preview ──
    const prev = rangePlacingPreviewRef.current;
    if (prev) {
      const pc = rangePlacingColorRef.current ?? '#ff5252';
      const { shape, p1, p2, cursor } = prev;
      // livePt2: confirmed p2, or cursor if p2 not yet clicked
      const livePt2: Pt | null = p2 ?? cursor;
      // livePt3: cursor only makes sense as p3 once p2 is confirmed
      const livePt3: Pt | null = p2 ? cursor : null;

      drawAnchor(p1.x, p1.y, pc, 0.9);
      if (p2) drawAnchor(p2.x, p2.y, pc, 0.7);

      if (shape === 'point') {
        // point has no preview (placed immediately on click)
      } else if (shape === 'circle' && livePt2) {
        const r = Math.hypot(livePt2.x - p1.x, livePt2.y - p1.y);
        if (r > 0) drawCircleShape(p1.x, p1.y, r, pc, 0.6);
      } else if (shape === 'line' && livePt2) {
        drawLineShape(p1, livePt2, pc, 0.6);
      } else if (shape === 'cylinder') {
        if (!p2 && livePt2) {
          drawLineShape(p1, livePt2, pc, 0.6); // axis preview
        } else if (p2 && livePt3) {
          drawRectShape(p1, p2, livePt3, pc, 0.6);
        } else if (p2) {
          drawLineShape(p1, p2, pc, 0.6); // axis confirmed, waiting for width
        }
      } else if (shape === 'cone') {
        if (!p2 && livePt2) {
          drawLineShape(p1, livePt2, pc, 0.6); // direction preview
        } else if (p2 && livePt3) {
          drawConeShape(p1, p2, livePt3, pc, 0.6);
        } else if (p2) {
          drawLineShape(p1, p2, pc, 0.6); // base-center confirmed, waiting for edge
        }
      }
    }
  }, []);

  /* ── Update marks overlay ── */
  const updateMarks = useCallback(() => {
    const overlay = marksOverlayRef.current;
    if (!overlay) return;
    overlay.innerHTML = '';
    // When showMarks is off, clear all screen positions so hover popup never triggers
    if (!showMarksRef.current) {
      marksRef.current.forEach(m => { m.screenX = undefined; m.screenY = undefined; });
      return;
    }
    const { scale, originX, originY } = camRef.current;
    const canvas = canvasRef.current!;
    const addMark = (
      sx: number, sy: number,
      markType: string | undefined,
    ) => {
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return;
      const el = document.createElement('div');
      el.className = 'map-mark map-mark--' + (markType || 'dot');
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      overlay.appendChild(el);
    };

    for (const m of marksRef.current) {
      const node = m.node;

      if (m.isGeneral) {
        const gm = node as MapGeneralMark;
        const shouldShow = m.parentNode ? (scale >= m.parentNode.appearScale) : true;
        if (!shouldShow) { m.screenX = undefined; m.screenY = undefined; continue; }
        const sx = canvas.width / 2 + (gm.x - originX) * scale;
        const sy = canvas.height / 2 + (gm.y - originY) * scale;
        addMark(sx, sy, gm.markType);
        m.screenX = sx;
        m.screenY = sy;
      } else {
        const rn = node as RuntimeNode;
        let shouldShow: boolean;
        if (m.parentNode) {
          shouldShow = (scale >= m.parentNode.appearScale) && (scale < rn.appearScale);
        } else {
          shouldShow = scale < rn.appearScale;
        }
        if (!shouldShow) { m.screenX = undefined; m.screenY = undefined; continue; }
        const sx = canvas.width / 2 + (rn.x - originX) * scale;
        const sy = canvas.height / 2 + (rn.y - originY) * scale;
        addMark(sx, sy, rn.markType);
        m.screenX = sx;
        m.screenY = sy;
      }
    }
  }, []);

  /* ── Update sounds ── */
  const updateSounds = useCallback(() => {
    if (!volumeEnabled || !userInteracted.current) {
      soundsRef.current.forEach(s => {
        if (s.playing && s.audio) { s.audio.pause(); s.playing = false; }
      });
      return;
    }
    const now = Date.now();
    if (now - lastSoundUpdateRef.current < 200) return;
    lastSoundUpdateRef.current = now;

    const { originX, originY, scale } = camRef.current;
    const sounds = soundsRef.current;

    const valid = sounds.filter(s => {
      const minX = Math.min(s.x1, s.x2), maxX = Math.max(s.x1, s.x2);
      const minY = Math.min(s.y1, s.y2), maxY = Math.max(s.y1, s.y2);
      const okPos = originX >= minX && originX <= maxX && originY >= minY && originY <= maxY;
      const okScale = scale >= (s.minScale ?? 0) && (!s.maxScale || scale <= s.maxScale);
      return okPos && okScale;
    });
    valid.sort((a, b) => (b.minScale ?? 0) - (a.minScale ?? 0));
    const topSound = valid[0] ?? null;

    sounds.forEach(s => {
      if (s === topSound) {
        if (!s.playing && s.audio) {
          s.audio.currentTime = 0;
          s.audio.play().catch(() => {});
          s.playing = true;
        }
      } else if (s.playing && s.audio) {
        s.audio.pause();
        s.playing = false;
      }
    });
  }, [volumeEnabled]);

  /* ── Main render ── */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    configRef.current.forEach(node => drawNode(ctx, node));
    drawRangeMarks(ctx);
    drawEntities(ctx);
    updateMarks();
    updateSounds();
  }, [drawNode, drawRangeMarks, drawEntities, updateMarks, updateSounds]);

  // Stable ref for render/commitViewState (used in native event handlers)
  const renderRef = useRef(render);
  const commitViewStateRef = useRef(commitViewState);
  useEffect(() => { renderRef.current = render; }, [render]);
  useEffect(() => { commitViewStateRef.current = commitViewState; }, [commitViewState]);

  /* ── Resize canvas ── */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    // Use offsetWidth/offsetHeight (CSS layout size, pre-transform) so canvas pixels
    // match the overlay's CSS coordinate space. getBoundingClientRect returns visual
    // (post-transform) size which diverges when popup_scale != 1.
    canvas.width  = container.offsetWidth  || container.getBoundingClientRect().width;
    canvas.height = container.offsetHeight || container.getBoundingClientRect().height;
    // For synced (non-DM) views, re-apply the scale adjustment for the new canvas size
    const vs = lastSyncedViewStateRef.current;
    if (!onViewStateChangePropRef.current && vs?.dmWidth && vs.dmWidth > 0 && canvas.width > 0) {
      const wRatio = canvas.width / vs.dmWidth;
      const hRatio = (vs.dmHeight && vs.dmHeight > 0 && canvas.height > 0)
        ? canvas.height / vs.dmHeight
        : wRatio;
      camRef.current = {
        originX: vs.originX,
        originY: vs.originY,
        scale: Math.max(wRatio, hRatio) * vs.scale,
      };
    }
    clampCamera();
    renderRef.current();
  }, [clampCamera]);

  // Convert viewport clientX/clientY to canvas-space coordinates, correcting for any
  // CSS transform (e.g. popup_scale) applied to an ancestor element.
  const toCanvasXY = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // scaleX/scaleY = visual-to-layout ratio; 1.0 when no CSS transform
    const scaleX = canvas.offsetWidth  > 0 ? rect.width  / canvas.offsetWidth  : 1;
    const scaleY = canvas.offsetHeight > 0 ? rect.height / canvas.offsetHeight : 1;
    return {
      mx: (clientX - rect.left) / scaleX,
      my: (clientY - rect.top)  / scaleY,
    };
  }, []);

  /* ── Non-passive wheel event (prevents page scroll while zooming) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      if (!interactiveRef.current || e.deltaY === 0) return;
      e.preventDefault();
      userInteracted.current = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.offsetWidth  > 0 ? rect.width  / canvas.offsetWidth  : 1;
      const scaleY = canvas.offsetHeight > 0 ? rect.height / canvas.offsetHeight : 1;
      const mx = (e.clientX - rect.left) / scaleX;
      const my = (e.clientY - rect.top)  / scaleY;
      const isTouchpad = Math.abs(e.deltaY) < 50;
      const zf = e.deltaY < 0
        ? (isTouchpad ? 1.075 : 1.1)
        : (isTouchpad ? 0.925 : 0.9);
      const { scale, originX, originY } = camRef.current;
      const wx = (mx - canvas.width / 2) / scale + originX;
      const wy = (my - canvas.height / 2) / scale + originY;
      camRef.current.scale *= zf;
      camRef.current.originX = wx - (mx - canvas.width / 2) / camRef.current.scale;
      camRef.current.originY = wy - (my - canvas.height / 2) / camRef.current.scale;
      clampCameraRef.current();
      renderRef.current();
      commitViewStateRef.current();
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  /* ── Non-passive touch events (prevents page scroll while panning/pinching) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Helper: convert a client-space point to canvas layout-space (handles devicePixelRatio / CSS transforms)
    const clientToCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.offsetWidth  > 0 ? rect.width  / canvas.offsetWidth  : 1;
      const scaleY = canvas.offsetHeight > 0 ? rect.height / canvas.offsetHeight : 1;
      return {
        mx: (clientX - rect.left) / scaleX,
        my: (clientY - rect.top)  / scaleY,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!interactiveRef.current) return;
      e.preventDefault();
      userInteracted.current = true;
      const t = touchRef.current;
      t.touches = {};
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        t.touches[touch.identifier] = { x: touch.clientX, y: touch.clientY };
      }

      // ── Double-tap to start entity drag ──
      if (e.touches.length === 1 && onEntityDragRef.current) {
        const now = Date.now();
        const touch = e.touches[0];
        const tapDx = touch.clientX - t.lastTapX;
        const tapDy = touch.clientY - t.lastTapY;
        const isDoubleTap = (now - t.lastTapTime) < 320 && Math.sqrt(tapDx * tapDx + tapDy * tapDy) < 50;
        if (isDoubleTap) {
          // Hit-test entities
          const { mx, my } = clientToCanvas(touch.clientX, touch.clientY);
          const { scale, originX, originY } = camRef.current;
          const worldX = (mx - canvas.width / 2) / scale + originX;
          const worldY = (my - canvas.height / 2) / scale + originY;
          const ents = entitiesRef.current;
          for (let i = ents.length - 1; i >= 0; i--) {
            const ent = ents[i];
            if (ent.parent_path) {
              const pn = getNodeByPath(configRef.current, ent.parent_path);
              if (!pn || scale < pn.appearScale) continue;
            }
            const dx = worldX - ent.x;
            const dy = worldY - ent.y;
            const r = Math.max(10 / scale, ent.scale);
            if (dx * dx + dy * dy <= r * r) {
              entityDragRef.current = { entityId: ent.id, startWorldX: worldX, startWorldY: worldY, origX: ent.x, origY: ent.y, hasMoved: false, currentX: ent.x, currentY: ent.y };
              t.lastTapTime = 0; // consume the double-tap
              break;
            }
          }
        } else {
          t.lastTapTime = now;
          t.lastTapX = touch.clientX;
          t.lastTapY = touch.clientY;
        }
      }

      if (e.touches.length === 2) {
        // Cancel any entity drag when a second finger appears
        entityDragRef.current = null;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        t.initialDistance = Math.sqrt(dx * dx + dy * dy);
        t.initialScale = camRef.current.scale;
        t.startOriginX = camRef.current.originX;
        t.startOriginY = camRef.current.originY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!interactiveRef.current) return;
      e.preventDefault();
      const t = touchRef.current;
      if (e.touches.length === 1) {
        const touch = e.touches[0];

        // ── Entity drag mode (double-tap activated) ──
        if (entityDragRef.current) {
          const { mx, my } = clientToCanvas(touch.clientX, touch.clientY);
          const { scale, originX, originY } = camRef.current;
          const worldX = (mx - canvas.width / 2) / scale + originX;
          const worldY = (my - canvas.height / 2) / scale + originY;
          const ed = entityDragRef.current;
          const ddx = worldX - ed.startWorldX;
          const ddy = worldY - ed.startWorldY;
          const DRAG_THRESHOLD = 5 / scale;
          if (Math.abs(ddx) > DRAG_THRESHOLD || Math.abs(ddy) > DRAG_THRESHOLD) ed.hasMoved = true;
          if (ed.hasMoved && onEntityDragRef.current) {
            ed.currentX = ed.origX + ddx;
            ed.currentY = ed.origY + ddy;
            onEntityDragRef.current(ed.entityId, ed.currentX, ed.currentY);
            renderRef.current();
          }
          // Update touch position so releasing drag doesn't teleport
          t.touches[touch.identifier] = { x: touch.clientX, y: touch.clientY };
          return;
        }

        // ── Normal pan ──
        const old = t.touches[touch.identifier];
        if (old) {
          const { scale } = camRef.current;
          camRef.current.originX -= (touch.clientX - old.x) / scale;
          camRef.current.originY -= (touch.clientY - old.y) / scale;
          t.touches[touch.identifier] = { x: touch.clientX, y: touch.clientY };
          clampCameraRef.current();
          renderRef.current();
          commitViewStateRef.current();
        }
      } else if (e.touches.length === 2 && t.initialDistance > 0) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const newScale = t.initialScale * (dist / t.initialDistance);

        // Midpoint of the two fingers in CSS pixels, relative to canvas top-left
        const rect = canvas.getBoundingClientRect();
        const dpr = canvas.width / rect.width;
        const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * dpr;
        const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * dpr;

        // World point under the pinch midpoint (computed from the gesture-start state)
        const wx = (cx - canvas.width / 2) / t.initialScale + t.startOriginX;
        const wy = (cy - canvas.height / 2) / t.initialScale + t.startOriginY;

        // Adjust origin so that world point stays fixed under the midpoint
        camRef.current.scale = newScale;
        camRef.current.originX = wx - (cx - canvas.width / 2) / newScale;
        camRef.current.originY = wy - (cy - canvas.height / 2) / newScale;
        clampCameraRef.current();
        renderRef.current();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!interactiveRef.current) return;
      e.preventDefault();
      const t = touchRef.current;

      // ── Finalize entity drag ──
      if (entityDragRef.current && e.touches.length === 0) {
        const ed = entityDragRef.current;
        entityDragRef.current = null;
        if (ed.hasMoved && onEntityDragEndRef.current) {
          onEntityDragEndRef.current(ed.entityId, ed.currentX, ed.currentY);
        }
        commitViewStateRef.current();
        return;
      }

      const remaining: Record<number, { x: number; y: number }> = {};
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        remaining[touch.identifier] = { x: touch.clientX, y: touch.clientY };
      }
      t.touches = remaining;
      if (e.touches.length < 2) t.initialDistance = 0;
      commitViewStateRef.current();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  /* ── Initialize / update map data ── */
  useEffect(() => {
    if (!mapData) {
      configRef.current = [];
      marksRef.current = [];
      soundsRef.current.forEach(s => { if (s.audio) { s.audio.pause(); } });
      soundsRef.current = [];
      render();
      return;
    }

    const config = JSON.parse(JSON.stringify(mapData.config ?? [])) as RuntimeNode[];
    config.forEach(node => loadImages(node, resolvedAssetBase, mapData.gallery));
    configRef.current = config;

    // Build marks
    const marks: RuntimeMark[] = [];
    const collectMarks = (node: RuntimeNode, parent: RuntimeNode | null) => {
      if (node.mark !== undefined) {
        marks.push({ node, isGeneral: false, parentNode: parent });
      }
      if (node.children) {
        node.children.forEach(child => collectMarks(child, node));
      }
    };
    config.forEach(node => collectMarks(node, null));
    (mapData.generalMarks ?? []).forEach(gm => {
      const parentNode = gm.parentPath ? getNodeByPath(config, gm.parentPath) : null;
      marks.push({ node: gm, isGeneral: true, parentNode });
    });
    marksRef.current = marks;

    // Build sounds
    soundsRef.current.forEach(s => { if (s.audio) s.audio.pause(); });
    soundsRef.current = (mapData.sounds ?? []).map(s => {
      const audioSrc = resolveAssetUrl(s.src, resolvedAssetBase, mapData.gallery);
      const audio = new Audio(audioSrc);
      audio.loop = true;
      audio.volume = (s.volume ?? 100) / 100;
      return { ...s, audio, playing: false } as RuntimeSound;
    });

    // Schedule re-renders as images load
    let count = 0;
    const iv = setInterval(() => {
      render();
      if (++count >= 12) clearInterval(iv);
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData]);

  /* ── Sync external view state (non-DM players) ── */
  useEffect(() => {
    if (viewState) {
      lastSyncedViewStateRef.current = viewState;
      const canvas = canvasRef.current;
      if (viewState.dmWidth && viewState.dmWidth > 0 && canvas && canvas.width > 0) {
        // Cover: scale so this canvas fills its container while preserving the DM's view
        const wRatio = canvas.width / viewState.dmWidth;
        const hRatio = (viewState.dmHeight && viewState.dmHeight > 0 && canvas.height > 0)
          ? canvas.height / viewState.dmHeight
          : wRatio;
        camRef.current = {
          originX: viewState.originX,
          originY: viewState.originY,
          scale: Math.max(wRatio, hRatio) * viewState.scale,
        };
      } else {
        camRef.current = { originX: viewState.originX, originY: viewState.originY, scale: viewState.scale };
      }
      clampCamera();
      renderRef.current();
    }
    // renderRef / clampCamera are stable — intentionally not in deps to prevent camera reset on re-renders
  }, [viewState]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Resize observer ── */
  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  /* ── Re-render on prop changes (use renderRef to avoid camera reset) ── */
  useEffect(() => { renderRef.current(); }, [showMarks, showSounds, volumeEnabled]);
  useEffect(() => { renderRef.current(); }, [entities]);
  useEffect(() => { renderRef.current(); }, [rangeMarks]);
  useEffect(() => { renderRef.current(); }, [rangePlacingPreview]);

  /* ── Mouse navigation handlers ── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    userInteracted.current = true;
    const { mx, my } = toCanvasXY(e.clientX, e.clientY);
    const world = screenToWorld(mx, my);
    const { scale } = camRef.current;

    // ── Right-click: open entity context action ──
    if (e.button === 2) {
      if (onEntityRightClick) {
        for (let i = entities.length - 1; i >= 0; i--) {
          const ent = entities[i];
          if (ent.parent_path) {
            const pn = getNodeByPath(configRef.current, ent.parent_path);
            if (!pn || scale < pn.appearScale) continue;
          }
          const dx = world.x - ent.x;
          const dy = world.y - ent.y;
          const r = Math.max(10 / scale, ent.scale);
          if (dx * dx + dy * dy <= r * r) {
            e.preventDefault();
            onEntityRightClick(ent);
            return;
          }
        }
      }
  // Right-click on range mark → delete
      if (onRangeMarkRightClickRef.current) {
        for (let i = rangeMarksRef.current.length - 1; i >= 0; i--) {
          const rm = rangeMarksRef.current[i];
          if (rm.parent_path) {
            const pn = getNodeByPath(configRef.current, rm.parent_path);
            if (!pn || scale < pn.appearScale) continue;
          }
          if (hitRangeMark(rm, world.x, world.y, scale)) {
            e.preventDefault();
            onRangeMarkRightClickRef.current(rm);
            return;
          }
        }
      }
      return; // don't start pan on right-click
    }

    // ── Left-click: check range mark hit for drag (before entity check) ──
    if (e.button === 0 && onRangeMarkDragEndRef.current && !spaceHeldRef.current) {
      for (let i = rangeMarksRef.current.length - 1; i >= 0; i--) {
        const rm = rangeMarksRef.current[i];
        if (rm.parent_path) {
          const pn = getNodeByPath(configRef.current, rm.parent_path);
          if (!pn || scale < pn.appearScale) continue;
        }
        if (hitRangeMark(rm, world.x, world.y, scale)) {
          rangeMarkDragRef.current = {
            markId: rm.id,
            startWorldX: world.x, startWorldY: world.y,
            origX: rm.x, origY: rm.y,
            origX2: rm.x2 ?? null, origY2: rm.y2 ?? null,
            origX3: rm.x3 ?? null, origY3: rm.y3 ?? null,
            hasMoved: false,
            currentX: rm.x, currentY: rm.y,
            currentX2: rm.x2 ?? null, currentY2: rm.y2 ?? null,
            currentX3: rm.x3 ?? null, currentY3: rm.y3 ?? null,
          };
          e.preventDefault();
          return;
        }
      }
    }

    // ── Left-click only: check entity hit for drag (skipped while Space is held) ──
    if (e.button === 0 && onEntityDrag && !spaceHeldRef.current) {
      for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (ent.parent_path) {
          const pn = getNodeByPath(configRef.current, ent.parent_path);
          if (!pn || scale < pn.appearScale) continue;
        }
        const dx = world.x - ent.x;
        const dy = world.y - ent.y;
        const r = Math.max(10 / scale, ent.scale);
        if (dx * dx + dy * dy <= r * r) {
          entityDragRef.current = { entityId: ent.id, startWorldX: world.x, startWorldY: world.y, origX: ent.x, origY: ent.y, hasMoved: false, currentX: ent.x, currentY: ent.y };
          e.preventDefault();
          return;
        }
      }
    }

    dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, hasDragged: false };
  }, [interactive, onEntityDrag, onEntityRightClick, entities, screenToWorld, toCanvasXY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;

    const { mx, my } = toCanvasXY(e.clientX, e.clientY);

    // ── Mark hover detection (canvas-level, no DOM pointer-events needed on marks) ──
    const infoDiv = markInfoRef.current;
    if (infoDiv) {
      if (showMarkInfoRef.current) {
        let hovered: RuntimeMark | null = null;
        for (const m of marksRef.current) {
          if (m.screenX == null || m.screenY == null) continue;
          const ddx = mx - m.screenX;
          const ddy = my - m.screenY;
          if (ddx * ddx + ddy * ddy <= MARK_HOVER_R * MARK_HOVER_R) { hovered = m; break; }
        }
        if (hovered) {
          const node = hovered.node;
          const name = (node as MapGeneralMark).name || (node as RuntimeNode).name || '';
          const desc = (node as { mark?: string }).mark || '';
          infoDiv.innerHTML = desc
            ? `<strong>${name}</strong><br>${desc}`
            : `<strong>${name}</strong>`;
          infoDiv.style.left = `${hovered.screenX}px`;
          infoDiv.style.top = `${hovered.screenY! - 8}px`;
          infoDiv.style.transform = 'translate(-50%, calc(-100% - 6px))';
          infoDiv.style.display = 'block';
        } else {
          infoDiv.style.display = 'none';
        }
      } else {
        infoDiv.style.display = 'none';
      }
    }

    // Entity drag
    if (entityDragRef.current) {
      const world = screenToWorld(mx, my);
      const ed = entityDragRef.current;
      const ddx = world.x - ed.startWorldX;
      const ddy = world.y - ed.startWorldY;
      const DRAG_THRESHOLD = 5 / camRef.current.scale; // 5 screen-px in world-space
      if (Math.abs(ddx) > DRAG_THRESHOLD || Math.abs(ddy) > DRAG_THRESHOLD) {
        ed.hasMoved = true;
      }
      if (ed.hasMoved && onEntityDrag) {
        const nx = ed.origX + ddx;
        const ny = ed.origY + ddy;
        ed.currentX = nx;
        ed.currentY = ny;
        onEntityDrag(ed.entityId, nx, ny);
        renderRef.current();
      }
      return;
    }

    // Range mark drag
    if (rangeMarkDragRef.current) {
      const world = screenToWorld(mx, my);
      const rd = rangeMarkDragRef.current;
      const ddx = world.x - rd.startWorldX;
      const ddy = world.y - rd.startWorldY;
      const DRAG_THRESHOLD = 5 / camRef.current.scale;
      if (Math.abs(ddx) > DRAG_THRESHOLD || Math.abs(ddy) > DRAG_THRESHOLD) rd.hasMoved = true;
      if (rd.hasMoved) {
        rd.currentX = rd.origX + ddx;
        rd.currentY = rd.origY + ddy;
        rd.currentX2 = rd.origX2 !== null ? rd.origX2 + ddx : null;
        rd.currentY2 = rd.origY2 !== null ? rd.origY2 + ddy : null;
        rd.currentX3 = rd.origX3 !== null ? rd.origX3 + ddx : null;
        rd.currentY3 = rd.origY3 !== null ? rd.origY3 + ddy : null;
        // Optimistic local update
        const idx = rangeMarksRef.current.findIndex(r => r.id === rd.markId);
        if (idx !== -1) {
          rangeMarksRef.current = rangeMarksRef.current.map((r, i) =>
            i === idx ? { ...r, x: rd.currentX, y: rd.currentY, x2: rd.currentX2, y2: rd.currentY2, x3: rd.currentX3, y3: rd.currentY3 } : r,
          );
        }
        renderRef.current();
      }
      return;
    }

    const d = dragRef.current;
    if (!d.isDragging) {
      // Fire world position callback for previews (e.g. range mark placement)
      if (onCanvasMouseMoveRef.current) {
        const world = screenToWorld(mx, my);
        onCanvasMouseMoveRef.current(world.x, world.y);
      }
      return;
    }

    const { scale } = camRef.current;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) d.hasDragged = true;
    camRef.current.originX -= dx;
    camRef.current.originY -= dy;
    d.startX = e.clientX;
    d.startY = e.clientY;
    clampCamera();
    renderRef.current();
    commitViewStateRef.current();
  }, [interactive, screenToWorld, onEntityDrag, toCanvasXY, clampCamera]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // ignore right-click mouseup

    // Range mark drag end
    if (rangeMarkDragRef.current) {
      const rd = rangeMarkDragRef.current;
      rangeMarkDragRef.current = null;
      if (rd.hasMoved && onRangeMarkDragEndRef.current) {
        onRangeMarkDragEndRef.current(
          rd.markId, rd.currentX, rd.currentY,
          rd.currentX2, rd.currentY2, rd.currentX3, rd.currentY3,
        );
      }
      return;
    }

    if (entityDragRef.current) {
      const ed = entityDragRef.current;
      const wasMoved = ed.hasMoved;
      entityDragRef.current = null;
      if (wasMoved) {
        // Notify parent that drag is complete so it can persist the final position
        if (onEntityDragEnd) onEntityDragEnd(ed.entityId, ed.currentX, ed.currentY);
        return;
      }
      // No movement — treat as a regular left click on entity
      if (!interactive) return;
      if (onEntityClick) {
        const { mx: ecx, my: ecy } = toCanvasXY(e.clientX, e.clientY);
        const world = screenToWorld(ecx, ecy);
        const { scale } = camRef.current;
        for (let i = entities.length - 1; i >= 0; i--) {
          const ent = entities[i];
          if (ent.parent_path) {
            const pn = getNodeByPath(configRef.current, ent.parent_path);
            if (!pn || scale < pn.appearScale) continue;
          }
          const dx = world.x - ent.x;
          const dy = world.y - ent.y;
          const r = Math.max(10 / scale, ent.scale);
          if (dx * dx + dy * dy <= r * r) { onEntityClick(ent); return; }
        }
      }
      return;
    }

    const d = dragRef.current;
    d.isDragging = false;

    if (d.hasDragged) {
      commitViewState();
      return;
    }

    if (!interactive) return;

    const { mx: cmx, my: cmy } = toCanvasXY(e.clientX, e.clientY);
    const world = screenToWorld(cmx, cmy);
    const { scale } = camRef.current;

    // ── Pick node mode (parent path selection) ──
    if (pickingNodeMode && onPickNode) {
      const result = findNodeAtWorld(configRef.current, world.x, world.y, scale);
      onPickNode(result?.path ?? '', result?.name ?? '');
      return;
    }

    // ── Entity click ──
    if (onEntityClick) {
      for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (ent.parent_path) {
          const pn = getNodeByPath(configRef.current, ent.parent_path);
          if (!pn || scale < pn.appearScale) continue;
        }
        const dx = world.x - ent.x;
        const dy = world.y - ent.y;
        const r = Math.max(10 / scale, ent.scale);
        if (dx * dx + dy * dy <= r * r) {
          onEntityClick(ent);
          return;
        }
      }
    }

    if (onCanvasClick) {
      const clickedNode = findNodeAtWorld(configRef.current, world.x, world.y, scale);
      onCanvasClick(world.x, world.y, clickedNode?.path);
    }
  }, [interactive, pickingNodeMode, onPickNode, onEntityClick, onCanvasClick, onEntityDragEnd, entities, screenToWorld, commitViewState, toCanvasXY]);

  /* ── Cursor style ── */
  const getCursor = () => {
    if (pickingNodeMode) return 'crosshair';
    if (interactive) return 'grab';
    return 'default';
  };

  return (
    <div
      ref={containerRef}
      className="map-engine"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={e => e.preventDefault()}
        onMouseLeave={() => {
          dragRef.current.isDragging = false;
          entityDragRef.current = null;
          rangeMarkDragRef.current = null;
          if (markInfoRef.current) markInfoRef.current.style.display = 'none';
        }}
      />
      {/* Marks overlay — pointer-events none so map interaction works; individual marks enable pointer-events */}
      <div
        ref={marksOverlayRef}
        className="map-marks-overlay"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {/* Mark description popup — position set dynamically by handleMouseMove */}
      <div
        ref={markInfoRef}
        className="map-mark-info"
      />
    </div>
  );
}
