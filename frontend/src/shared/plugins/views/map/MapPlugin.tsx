import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Volume2, VolumeX, MapPin, MapPinOff, Trash2, RefreshCw, Plus, Layers, X, Eye, EyeOff, Maximize2, Minimize2, BookOpen } from 'lucide-react';
import PluginShell from '../../PluginShell';
import { Spinner, ComboSearch } from '../../../ui';
import type { ComboSearchItem } from '../../../ui';
import { useAuth } from '../../../../app/providers/useAuth';
import { useCampaign } from '../../../../app/providers/useCampaign';
import { onMapUpdated, onMapViewState, onMapEntitiesUpdated, emitMapViewStateLive, emitEntityMoveLive, onEntityMoved, onMapRangeMarksUpdated } from '../../../../services/socket';
import * as mapsApi from '../../../../services/api/maps';
import * as creaturesApi from '../../../../services/api/creatures';
import MapEngine from './MapEngine';
import { SheetViewer } from '../sheet/SheetViewer';
import type { MapRecord, MapEntity, MapRangeMark, RangeMarkShape, MapViewState, Creature, PluginViewMode } from '../../../types';
import '../plugin-view.css';
import './map-plugin.css';

/* ────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────── */

export function MapPlugin({ viewMode = 'widget' }: { viewMode?: PluginViewMode }) {
  const { user } = useAuth();
  const { activeCampaignId, characters, isDm, pluginConfig } = useCampaign();
  const config = pluginConfig('map') ?? {};

  /* ── State ── */
  const [loading, setLoading]   = useState(true);
  const [maps, setMaps]         = useState<MapRecord[]>([]);
  const [activeMap, setActiveMap] = useState<MapRecord | null>(null);
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [rangeMarks, setRangeMarks] = useState<MapRangeMark[]>([]);

  // Range mark placement state
  const [placingRangeMark, setPlacingRangeMark] = useState(false);
  const [rangeMarkShape, setRangeMarkShape] = useState<RangeMarkShape>('circle');
  const [rmp1, setRmp1] = useState<{ x: number; y: number } | null>(null); // 1st click
  const [rmp2, setRmp2] = useState<{ x: number; y: number } | null>(null); // 2nd click (3-point shapes)
  const [rmpCursor, setRmpCursor] = useState<{ x: number; y: number } | null>(null);
  const [rmpParentPath, setRmpParentPath] = useState<string | null>(null); // image layer at 1st click
  const [rangeMarkColor, setRangeMarkColor] = useState('#ff5252');

  const [showMarks, setShowMarks]       = useState(config.show_marks_by_default !== false);
  const [volumeEnabled, setVolumeEnabled] = useState(false);

  // Entity placement form (fullscreen only)
  const [placingEntity, setPlacingEntity] = useState<{ type: 'character' | 'creature' | 'custom_npc' | 'custom_enemy'; id: number; name: string } | null>(null);
  const [placeScale, setPlaceScale]           = useState(3);
  const [placeScaleInput, setPlaceScaleInput] = useState('3');
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickingParent, setPickingParent]     = useState(false);
  const [placeParentPath, setPlaceParentPath] = useState<string | null>(null);
  const [placeParentName, setPlaceParentName] = useState('');
  const [pickedWorldPos, setPickedWorldPos]   = useState<{ x: number; y: number } | null>(null);

  // Edit mode — set when clicking a placed entity in fullscreen
  const [editEntityId, setEditEntityId] = useState<number | null>(null);
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<MapEntity | null>(null);

  // JSON upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Throttle for live entity drag broadcasts: entityId -> last emit timestamp
  const entityMoveThrottleRef = useRef<Map<number, number>>(new Map());
  // Native browser fullscreen target
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false);

  // Player permissions
  const playersCanMove    = !!config.players_can_move_tokens;
  const playersCanInfobox = !!config.players_can_see_infobox;

  /* ── Entity combo items ── */
  const entityItems = useMemo<ComboSearchItem[]>(() => {
    const charItems: ComboSearchItem[] = characters.map(c => ({
      id: `char-${c.id}`,
      label: c.name,
      badge: 'character',
      badgeVariant: 'character',
    }));
    const creatureItems: ComboSearchItem[] = creatures.map(c => ({
      id: `creature-${c.id}`,
      label: c.name,
      badge: c.type,
      badgeVariant: c.type,
    }));
    return [...charItems, ...creatureItems];
  }, [characters, creatures]);

  // Exclude characters already placed (unique), creatures can be duplicated
  const excludeIds = useMemo(() => {
    const set = new Set<string | number>();
    entities.filter(e => e.entity_type === 'character').forEach(e => set.add(`char-${e.entity_id}`));
    return set;
  }, [entities]);

  // Stable ref so socket callbacks always read the latest maps list
  const mapsRef = useRef<MapRecord[]>([]);
  useEffect(() => { mapsRef.current = maps; }, [maps]);
  // Stable map id ref for the persist timer (avoids stale closure in setTimeout)
  const activeMapIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeMapIdRef.current = activeMap?.id ?? null;
    // Remember selection so it survives fullscreen ↔ widget remounts
    if (activeCampaignId && activeMap?.id != null) {
      sessionStorage.setItem(`map_active_${activeCampaignId}`, String(activeMap.id));
    }
  }, [activeMap, activeCampaignId]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load ── */
  const loadMaps = useCallback(async () => {
    if (!activeCampaignId) return;
    const rows = await mapsApi.listMaps(activeCampaignId);
    setMaps(rows);
    return rows;
  }, [activeCampaignId]);

  const loadEntities = useCallback(async (mapId: number) => {
    const rows = await mapsApi.listEntities(mapId);
    setEntities(rows);
  }, []);

  const loadRangeMarks = useCallback(async (mapId: number) => {
    const rows = await mapsApi.listRangeMarks(mapId);
    setRangeMarks(rows);
  }, []);

  const load = useCallback(async () => {
    if (!activeCampaignId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [rows, crRows] = await Promise.all([
        loadMaps(),
        creaturesApi.listCreatures(activeCampaignId),
      ]);
      setCreatures(crRows);
      if (rows && rows.length > 0) {
        const savedId = activeCampaignId
          ? parseInt(sessionStorage.getItem(`map_active_${activeCampaignId}`) ?? '', 10)
          : NaN;
        const initial = (!isNaN(savedId) && rows.find(m => m.id === savedId)) || rows[0];
        setActiveMap(initial);
        await Promise.all([loadEntities(initial.id), loadRangeMarks(initial.id)]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeCampaignId, loadMaps, loadEntities, loadRangeMarks]);

  useEffect(() => { load(); }, [load]);

  const isPopup      = viewMode === 'popup';
  const isWidget     = viewMode === 'widget';
  const isFullscreen = viewMode === 'fullscreen';

  /* ── Native fullscreen (map canvas) ── */
  useEffect(() => {
    const onChange = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleNativeFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      canvasAreaRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  /* ── Socket listeners ── */
  useEffect(() => {
    const unsub1 = onMapUpdated(async (p) => {
      if (p.campaignId !== activeCampaignId) return;
      const rows = await loadMaps();
      if (rows && activeMap) {
        const updated = rows.find(m => m.id === activeMap.id);
        if (updated) setActiveMap(updated);
        else if (rows.length > 0) {
          setEntities([]); // clear stale entities before switching
          setActiveMap(rows[0]);
          await loadEntities(rows[0].id);
        } else { setActiveMap(null); setEntities([]); }
      }
    });
    // Popup follows the DM's camera in real time; other views pan freely
    const unsub2 = onMapViewState(async (p) => {
      if (!isPopup) return;
      if (p.campaignId !== activeCampaignId) return;
      if (activeMap && p.mapId === activeMap.id) {
        // Same map — just sync view state
        setActiveMap(prev => prev ? { ...prev, view_state: p.viewState } : null);
      } else if (!activeMap || p.mapId !== activeMap.id) {
        // DM switched to a different map — follow them
        const newMap = mapsRef.current.find(m => m.id === p.mapId);
        if (newMap) {
          setEntities([]);
          setActiveMap({ ...newMap, view_state: p.viewState });
          await loadEntities(newMap.id);
        }
      }
    });
    const unsub3 = onMapEntitiesUpdated(async (p) => {
      if (p.campaignId !== activeCampaignId) return;
      if (activeMap && p.mapId === activeMap.id) {
        await loadEntities(activeMap.id);
      }
    });
    // Live entity drag from other clients
    const unsub4 = onEntityMoved(p => {
      if (p.campaignId !== activeCampaignId) return;
      if (!activeMap || p.mapId !== activeMap.id) return;
      setEntities(prev => prev.map(e => e.id === p.entityId ? { ...e, x: p.x, y: p.y } : e));
    });
    const unsub5 = onMapRangeMarksUpdated(async (p) => {
      if (p.campaignId !== activeCampaignId) return;
      if (activeMap && p.mapId === activeMap.id) {
        await loadRangeMarks(activeMap.id);
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [activeCampaignId, activeMap, isPopup, loadMaps, loadEntities, loadRangeMarks]);

  /* ── View state handler (DM only) ── */
  const handleViewStateChange = useCallback((vs: MapViewState) => {
    if (!isDm || !activeMap || !activeCampaignId) return;
    // Live path: relay directly via socket — no HTTP, no DB latency
    emitMapViewStateLive(activeCampaignId, activeMap.id, vs);
    // Persist path: debounced DB write, fires only after panning stops
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const id = activeMapIdRef.current;
      if (id) mapsApi.updateViewState(id, vs).catch(() => {});
    }, 1500);
  }, [isDm, activeMap, activeCampaignId]);

  /* ── Resolve parent name from map config ── */
  const getNodeNameByPath = useCallback((path: string): string => {
    if (!activeMap?.data?.config) return path;
    const nodes = activeMap.data.config;
    const indices = path.split(',').map(Number);
    let node: (typeof nodes)[number] | undefined = nodes[indices[0]];
    for (let i = 1; i < indices.length; i++) {
      if (!node?.children) return path;
      node = node.children[indices[i]];
    }
    return node?.name ?? path;
  }, [activeMap]);

  /* ── Reset form / edit state ── */
  const resetForm = useCallback(() => {
    setPlacingEntity(null);
    setPlaceScale(3);
    setPlaceScaleInput('3');
    setPlaceParentPath(null);
    setPlaceParentName('');
    setPickedWorldPos(null);
    setPickingLocation(false);
    setPickingParent(false);
    setEditEntityId(null);
  }, []);

  /* ── Map selector ── */
  const handleMapChange = useCallback(async (id: number) => {
    const map = maps.find(m => m.id === id);
    if (!map) return;
    // Clear all stale state before switching so there's no flash of old entities
    setEntities([]);
    setRangeMarks([]);
    setSelectedEntity(null);
    setEntityFilter('');
    resetForm();
    setPlacingRangeMark(false);
    setRmp1(null);
    setRmp2(null);
    setRmpCursor(null);
    setActiveMap(map);
    await Promise.all([loadEntities(map.id), loadRangeMarks(map.id)]);
  }, [maps, loadEntities, loadRangeMarks, resetForm]);

  /* ── JSON upload ── */
  const handleUploadJson = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCampaignId) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const mapName = json.mapName || file.name.replace('.json', '');
      const map = await mapsApi.createMap(activeCampaignId, {
        name: mapName,
        data: json,
      });
      await loadMaps();
      setActiveMap(map);
      await loadEntities(map.id);
    } catch (err) {
      console.error('Failed to upload map JSON:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [activeCampaignId, loadMaps, loadEntities]);

  /* ── Update map JSON ── */
  const handleUpdateJson = useCallback(async () => {
    if (!activeMap) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const updated = await mapsApi.updateMap(activeMap.id, { data: json });
        setActiveMap(updated);
      } catch (err) {
        console.error('Failed to update map JSON:', err);
      }
    };
    input.click();
  }, [activeMap]);

  /* ── Delete map ── */
  const handleDeleteMap = useCallback(async () => {
    if (!activeMap) return;
    await mapsApi.deleteMap(activeMap.id);
    const rows = await loadMaps();
    if (rows && rows.length > 0) {
      setActiveMap(rows[0]);
      await loadEntities(rows[0].id);
    } else {
      setActiveMap(null);
      setEntities([]);
    }
  }, [activeMap, loadMaps, loadEntities]);

  /* ── Entity placement ── */

  /* ── Canvas click: place new OR update existing position ── */
  const handleCanvasClick = useCallback(async (wx: number, wy: number, nodePath?: string) => {
    const rx = Math.round(wx * 100) / 100;
    const ry = Math.round(wy * 100) / 100;

    // ── Range mark multi-phase placement ──
    if (placingRangeMark && activeMap) {
      const is3pt = rangeMarkShape === 'cylinder' || rangeMarkShape === 'cone';

      // 1-click shape: point
      if (rangeMarkShape === 'point') {
        try {
          await mapsApi.createRangeMark(activeMap.id, {
            shape: 'point',
            x: rx, y: ry,
            x2: null, y2: null,
            x3: null, y3: null,
            radius: 0,
            color: rangeMarkColor,
            parent_path: nodePath ?? null,
          });
          await loadRangeMarks(activeMap.id);
        } catch (err) {
          console.error('Failed to create range mark:', err);
        }
        setRmp1(null); setRmp2(null); setRmpCursor(null); setRmpParentPath(null);
        setPlacingRangeMark(false);
        return;
      }

      if (!rmp1) {
        setRmp1({ x: rx, y: ry });
        setRmpParentPath(nodePath ?? null);
        return;
      }

      if (!rmp2) {
        if (!is3pt) {
          // 2-point shape (circle / line): done on 2nd click
          const dx = rx - rmp1.x, dy = ry - rmp1.y;
          const radius = Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100;
          if (radius > 0) {
            try {
              await mapsApi.createRangeMark(activeMap.id, {
                shape: rangeMarkShape,
                x: rmp1.x, y: rmp1.y,
                x2: rx, y2: ry,
                x3: null, y3: null,
                radius,
                color: rangeMarkColor,
                parent_path: rmpParentPath,
              });
              await loadRangeMarks(activeMap.id);
            } catch (err) {
              console.error('Failed to create range mark:', err);
            }
          }
          setRmp1(null); setRmp2(null); setRmpCursor(null); setRmpParentPath(null);
          setPlacingRangeMark(false);
          return;
        } else {
          // 3-point shape: store p2 only if axis has length, then wait for p3
          if (Math.hypot(rx - rmp1.x, ry - rmp1.y) > 0) {
            setRmp2({ x: rx, y: ry });
          }
          return;
        }
      }

      // 3rd click (cylinder / cone)
      const axisLen = Math.hypot(rmp2.x - rmp1.x, rmp2.y - rmp1.y);
      const sideLen = Math.hypot(rx - rmp2.x, ry - rmp2.y);
      if (axisLen > 0 && sideLen > 0) {
        try {
          await mapsApi.createRangeMark(activeMap.id, {
            shape: rangeMarkShape,
            x: rmp1.x, y: rmp1.y,
            x2: rmp2.x, y2: rmp2.y,
            x3: rx, y3: ry,
            radius: 0,
            color: rangeMarkColor,
            parent_path: rmpParentPath,
          });
          await loadRangeMarks(activeMap.id);
        } catch (err) {
          console.error('Failed to create range mark:', err);
        }
      }
      setRmp1(null); setRmp2(null); setRmpCursor(null); setRmpParentPath(null);
      setPlacingRangeMark(false);
      return;
    }

    if (editEntityId && activeMap) {
      // Edit mode: update position immediately
      try {
        await mapsApi.updateEntity(activeMap.id, editEntityId, { x: rx, y: ry });
        await loadEntities(activeMap.id);
      } catch (err) {
        console.error('Failed to update entity position:', err);
      }
      setPickingLocation(false);
      return;
    }

    if (!pickingLocation || !placingEntity || !activeMap) return;
    // Place mode: just store the picked position; Add button creates the entity
    setPickedWorldPos({ x: rx, y: ry });
    setPickingLocation(false);
  }, [editEntityId, pickingLocation, placingEntity, activeMap, loadEntities, placingRangeMark, rangeMarkShape, rmp1, rmp2, rangeMarkColor, rmpParentPath, loadRangeMarks]);

  /* ── Add new entity at picked location ── */
  const handleAddEntity = useCallback(async () => {
    if (!placingEntity || !pickedWorldPos || !activeMap) return;
    try {
      await mapsApi.createEntity(activeMap.id, {
        entity_type: placingEntity.type,
        entity_id: placingEntity.id,
        x: pickedWorldPos.x,
        y: pickedWorldPos.y,
        scale: placeScale,
        parent_path: placeParentPath,
        label: (placingEntity.type === 'custom_npc' || placingEntity.type === 'custom_enemy') ? placingEntity.name : null,
      });
      await loadEntities(activeMap.id);
    } catch (err) {
      console.error('Failed to place entity:', err);
    }
    resetForm();
  }, [placingEntity, pickedWorldPos, activeMap, placeScale, placeParentPath, loadEntities, resetForm]);

  /* ── Node pick: set parent for place OR edit ── */
  const handlePickNode = useCallback((path: string, name: string) => {
    setPlaceParentPath(path || null);
    setPlaceParentName(name);
    setPickingParent(false);
  }, []);

  /* ── Save entity edits ── */
  const handleSaveEntity = useCallback(async () => {
    if (!editEntityId || !activeMap) return;
    try {
      await mapsApi.updateEntity(activeMap.id, editEntityId, {
        scale: placeScale,
        parent_path: placeParentPath,
      });
      await loadEntities(activeMap.id);
    } catch (err) {
      console.error('Failed to update entity:', err);
    }
    resetForm();
  }, [editEntityId, activeMap, placeScale, placeParentPath, loadEntities, resetForm]);

  /* ── Entity drag ── */
  // During drag: only update local state optimistically (no API call to avoid socket spam)
  const handleEntityDrag = useCallback((entityId: number, x: number, y: number) => {
    if (!isDm) {
      if (!playersCanMove) return;
      const ent = entities.find(e => e.id === entityId);
      if (!ent || ent.entity_type !== 'character') return;
      const char = characters.find(c => c.id === ent.entity_id);
      if (!char || char.player_id !== user?.id) return;
    }
    // Optimistic local update only
    setEntities(prev => prev.map(e => e.id === entityId ? { ...e, x, y } : e));
    // Throttled real-time broadcast to other clients (~80 ms)
    if (activeMap && activeCampaignId) {
      const now = Date.now();
      const last = entityMoveThrottleRef.current.get(entityId) ?? 0;
      if (now - last >= 80) {
        entityMoveThrottleRef.current.set(entityId, now);
        emitEntityMoveLive({ campaignId: activeCampaignId, mapId: activeMap.id, entityId, x, y });
      }
    }
  }, [isDm, playersCanMove, entities, characters, user?.id, activeMap, activeCampaignId]);

  // On drag end: persist final position to server (triggers socket for other clients)
  const handleEntityDragEnd = useCallback(async (entityId: number, x: number, y: number) => {
    if (!activeMap) return;
    if (!isDm) {
      if (!playersCanMove) return;
      const ent = entities.find(e => e.id === entityId);
      if (!ent || ent.entity_type !== 'character') return;
      const char = characters.find(c => c.id === ent.entity_id);
      if (!char || char.player_id !== user?.id) return;
    }
    try {
      await mapsApi.updateEntity(activeMap.id, entityId, {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      });
    } catch (err) {
      console.error('Failed to save entity position:', err);
    }
  }, [activeMap, isDm, playersCanMove, entities, characters, user?.id]);

  /* ── Entity left-click: toggle infobox ── */
  const handleEntityClick = useCallback((ent: MapEntity) => {
    setSelectedEntity(prev => prev?.id === ent.id ? null : ent);
  }, []);

  /* ── Entity right-click: enter edit mode (DM fullscreen only) ── */
  const handleEntityRightClick = useCallback((ent: MapEntity) => {
    if (!isDm || viewMode !== 'fullscreen') return;
    if (editEntityId === ent.id) {
      resetForm();
      return;
    }
    setEditEntityId(ent.id);
    setPlacingEntity(null);
    setPlaceScale(ent.scale);
    setPlaceScaleInput(String(ent.scale));
    setPlaceParentPath(ent.parent_path);
    setPlaceParentName(ent.parent_path ? getNodeNameByPath(ent.parent_path) : '');
    setPickedWorldPos(null);
    setPickingLocation(false);
    setPickingParent(false);
  }, [isDm, viewMode, editEntityId, resetForm, getNodeNameByPath]);

  /* ── Delete entity ── */
  const handleDeleteEntity = useCallback(async (entId: number) => {
    if (!activeMap) return;
    await mapsApi.deleteEntity(activeMap.id, entId);
    await loadEntities(activeMap.id);
    if (selectedEntity?.id === entId) setSelectedEntity(null);
  }, [activeMap, loadEntities, selectedEntity]);

  /* ── Range mark callbacks ── */
  const handleRangeMarkRightClick = useCallback(async (mark: MapRangeMark) => {
    if (!activeMap) return;
    try {
      await mapsApi.deleteRangeMark(activeMap.id, mark.id);
      await loadRangeMarks(activeMap.id);
    } catch (err) {
      console.error('Failed to delete range mark:', err);
    }
  }, [activeMap, loadRangeMarks]);

  const handleRangeMarkDragEnd = useCallback(async (
    markId: number, x: number, y: number,
    x2: number | null, y2: number | null, x3: number | null, y3: number | null,
  ) => {
    if (!activeMap) return;
    const r = (v: number | null) => v !== null ? Math.round(v * 100) / 100 : null;
    try {
      await mapsApi.updateRangeMark(activeMap.id, markId, {
        x: r(x)!, y: r(y)!,
        x2: r(x2), y2: r(y2), x3: r(x3), y3: r(y3),
      });
    } catch (err) {
      console.error('Failed to save range mark position:', err);
    }
  }, [activeMap]);

  const handleCanvasMouseMove = useCallback((wx: number, wy: number) => {
    if (placingRangeMark && rmp1) {
      setRmpCursor({ x: wx, y: wy });
    }
  }, [placingRangeMark, rmp1]);

  /* ── Entity info helper ── */
  const selectedEntityInfo = useMemo(() => {
    if (!selectedEntity) return null;
    if (selectedEntity.entity_type === 'character') {
      const ch = characters.find(c => c.id === selectedEntity.entity_id);
      if (!ch) return null;
      return { name: ch.name, type: 'character' as const, hp: `${ch.hp_current}/${ch.hp_max}`, ac: ch.ac, speed: ch.speed, image: ch.image, level: ch.level, race: ch.race, class: ch.class };
    }
    const cr = creatures.find(c => c.id === selectedEntity.entity_id);
    if (!cr) return null;
    return { name: cr.name, type: cr.type, hp: `${cr.hp_current}/${cr.hp_max}`, ac: cr.ac, speed: cr.speed, image: cr.image, sheet_image: cr.sheet_image, cr: cr.cr, size: cr.size };
  }, [selectedEntity, characters, creatures]);

  /* ── Cancel range mark placement on Escape ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && placingRangeMark) {
        setPlacingRangeMark(false);
        setRmp1(null);
        setRmp2(null);
        setRmpCursor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placingRangeMark]);

  /* ── Viewport clamp bounds (player views are clamped to this area) ── */
  const clampBounds = useMemo(() => {
    const nw = activeMap?.data?.nativeWidth;
    const nh = activeMap?.data?.nativeHeight;
    if (!nw || !nh) return undefined;
    return { x: -nw / 2, y: -nh / 2, width: nw, height: nh };
  }, [activeMap?.data?.nativeWidth, activeMap?.data?.nativeHeight]);

  /* ── Toggle map visibility for players ── */
  const handleToggleVisibility = useCallback(async () => {
    if (!activeMap) return;
    const updated = await mapsApi.updateMap(activeMap.id, { is_visible: !activeMap.is_visible });
    setActiveMap(updated);
  }, [activeMap]);

  /* ── Derived: range placing preview for MapEngine ── */
  const rangePlacingPreview = (placingRangeMark && rmp1)
    ? { shape: rangeMarkShape, p1: rmp1, p2: rmp2, cursor: rmpCursor }
    : undefined;

  /* ── Hint text for the placement button ── */
  const rmHints: Record<RangeMarkShape, [string, string, string]> = {
    point:    ['Click position…',   '',                   ''],
    circle:   ['Click center…',     'Click edge…',        ''],
    line:     ['Click start…',      'Click end…',         ''],
    cylinder: ['Click axis start…', 'Click axis end…',    'Click width…'],
    cone:     ['Click vertex…',     'Click base center…', 'Click base edge…'],
  };
  const rmStep = !rmp1 ? 0 : !rmp2 ? 1 : 2;
  const rmHint = placingRangeMark ? rmHints[rangeMarkShape][rmStep] : `Add ${rangeMarkShape}`;

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <PluginShell slug="map" viewMode={viewMode}>
      <div className={`plugin-view mplg ${isFullscreen ? 'mplg--fs' : ''}`}>
        {loading && <div className="plugin-view__loading"><Spinner size="sm" /></div>}

        {/* ══════════════════════════════════
            NON-FULLSCREEN (widget / popup)
        ══════════════════════════════════ */}
        {!isFullscreen && !loading && (
          <>
            {!activeMap ? (
              <div className="mplg__empty">
                <p>No maps available</p>
                {isDm && (
                  <button className="mplg__btn mplg__btn--accent" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} /> Upload Map JSON
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mplg__toolbar">
                  <span className="mplg__map-name">{activeMap.name}</span>
                  {!isPopup && (
                    <button
                      className={`mplg__icon-btn ${showMarks ? 'mplg__icon-btn--active' : ''}`}
                      title="Toggle mark descriptions"
                      onClick={() => setShowMarks(v => !v)}
                    >
                      {showMarks ? <MapPin size={14} /> : <MapPinOff size={14} />}
                    </button>
                  )}
                  {!isPopup && (
                    <button
                      className={`mplg__icon-btn ${volumeEnabled ? 'mplg__icon-btn--active' : ''}`}
                      title="Toggle sounds"
                      onClick={() => setVolumeEnabled(v => !v)}
                    >
                      {volumeEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    </button>
                  )}
                  {!isPopup && (<button
                    className="mplg__icon-btn"
                    title={isNativeFullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
                    onClick={toggleNativeFullscreen}
                  >
                    {isNativeFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>)}
                </div>
                <div className="mplg__canvas-wrap" ref={canvasAreaRef}>
                  {isNativeFullscreen && (
                    <button className="mplg__fs-close" onClick={toggleNativeFullscreen} title="Exit fullscreen">
                      <Minimize2 size={14} />
                    </button>
                  )}
                  <MapEngine
                    mapData={activeMap.data}
                    viewState={activeMap.view_state}
                    onViewStateChange={(isDm && !isPopup) ? handleViewStateChange : undefined}
                    entities={entities}
                    characters={characters}
                    creatures={creatures}
                    showMarks={isPopup ? false : showMarks}
                    showMarkInfo={config.show_marks_by_default !== false}
                    showSounds={!isPopup}
                    volumeEnabled={!isPopup && volumeEnabled}
                    onEntityClick={!isPopup ? handleEntityClick : undefined}
                    onEntityRightClick={undefined}
                    onEntityDrag={(!isPopup && (isDm || playersCanMove)) ? handleEntityDrag : undefined}
                    onEntityDragEnd={(!isPopup && (isDm || playersCanMove)) ? handleEntityDragEnd : undefined}
                    clampBounds={!isDm ? clampBounds : undefined}
                    rangeMarks={rangeMarks}
                    interactive={!isPopup}
                  />
                </div>
                {isWidget && selectedEntityInfo && (isDm || playersCanInfobox) && (
                  <div className="mplg__infobox">
                    <div className="mplg__infobox-header">
                      {selectedEntityInfo.image && <img className="mplg__infobox-img" src={selectedEntityInfo.image} alt="" />}
                      <div>
                        <div className="mplg__infobox-name">{selectedEntityInfo.name}</div>
                        <div className="mplg__infobox-meta">
                          {selectedEntityInfo.type}
                          {'level' in selectedEntityInfo && ` · Lvl ${selectedEntityInfo.level}`}
                          {'cr' in selectedEntityInfo && selectedEntityInfo.cr && ` · CR ${selectedEntityInfo.cr}`}
                        </div>
                      </div>
                    </div>
                    <div className="mplg__infobox-stats">
                      <span>HP {selectedEntityInfo.hp}</span>
                      <span>AC {selectedEntityInfo.ac}</span>
                      <span>SPD {selectedEntityInfo.speed}</span>
                    </div>
                    {'sheet_image' in selectedEntityInfo && selectedEntityInfo.sheet_image && (
                      <button className="mplg__infobox-sheet-btn" title="View Sheet" onClick={() => setSheetUrl((selectedEntityInfo as { sheet_image?: string | null }).sheet_image!)}>
                        <BookOpen size={12} /> Sheet
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════
            FULLSCREEN
        ══════════════════════════════════ */}
        {isFullscreen && !loading && (
          <>
            {/* ── Top toolbar ── */}
            <div className="mplg__toolbar mplg__toolbar--fs">
              <div className="mplg__toolbar-left">
                {maps.length > 1 ? (
                  <select className="mplg__select" value={activeMap?.id ?? ''} onChange={e => handleMapChange(Number(e.target.value))}>
                    {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ) : (
                  <span className="mplg__map-name">{activeMap?.name ?? 'No map'}</span>
                )}
                <button
                  className={`mplg__icon-btn ${showMarks ? 'mplg__icon-btn--active' : ''}`}
                  title="Toggle mark descriptions"
                  onClick={() => setShowMarks(v => !v)}
                >
                  {showMarks ? <MapPin size={14} /> : <MapPinOff size={14} />}
                </button>
                <button
                  className={`mplg__icon-btn ${volumeEnabled ? 'mplg__icon-btn--active' : ''}`}
                  title="Toggle sounds"
                  onClick={() => setVolumeEnabled(v => !v)}
                >
                  {volumeEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
                <button
                  className="mplg__icon-btn"
                  title={isNativeFullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
                  onClick={toggleNativeFullscreen}
                >
                  {isNativeFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                {isDm && activeMap && (
                  <button className="mplg__icon-btn" title="Reload map JSON" onClick={handleUpdateJson}>
                    <RefreshCw size={14} />
                  </button>
                )}
                {isDm && activeMap && (
                  <button
                    className={`mplg__icon-btn ${activeMap.is_visible ? 'mplg__icon-btn--visible' : ''}`}
                    onClick={handleToggleVisibility}
                    title={activeMap.is_visible ? 'Hide from players' : 'Show to players'}
                  >
                    {activeMap.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
              </div>
              <div className="mplg__toolbar-right">
                {isDm && (
                  <button className="mplg__btn mplg__btn--accent" onClick={() => fileInputRef.current?.click()}>
                    <Plus size={13} /> New Map
                  </button>
                )}
              </div>
            </div>

            {/* ── Body: sidebar + canvas ── */}
            <div className="mplg__fs-body">

              {/* ── LEFT SIDEBAR (DM only) ── */}
              {isDm && (
                <div className="mplg__sidebar">

                {/* Form section */}
                <div className="mplg__sidebar-section">
                  <div className="mplg__sidebar-title">
                    Range mark
                  </div>

                  <div className="mplg__form-fields">
                    <div className="mplg__form-row">
                      <span className="mplg__form-label">Shape</span>
                      <div className="mplg__shape-picker">
                        {([
                          { value: 'point',    title: 'Point',
                            icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="8" cy="8" r="3"/></svg> },
                          { value: 'circle',   title: 'Sphere',
                            icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="5.5"/></svg> },
                          { value: 'line',     title: 'Line',
                            icon: <svg viewBox="0 0 16 16" width="14" height="14" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="14" x2="14" y2="2"/></svg> },
                          { value: 'cylinder', title: 'Cylinder',
                            icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="4" width="12" height="8" rx="1"/></svg> },
                          { value: 'cone',     title: 'Cone',
                            icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="8,2 14,14 2,14"/></svg> },
                        ] as { value: RangeMarkShape; title: string; icon: React.ReactNode }[]).map(s => (
                          <button
                            key={s.value}
                            className={`mplg__shape-btn${rangeMarkShape === s.value ? ' mplg__shape-btn--active' : ''}`}
                            title={s.title}
                            onClick={() => {
                              setRangeMarkShape(s.value);
                              setPlacingRangeMark(false);
                              setRmp1(null); setRmp2(null); setRmpCursor(null);
                            }}
                          >
                            {s.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mplg__form-row">
                      <span className="mplg__form-label">Color</span>
                      <div className="mplg__color-picker">
                        {(['#ff5252','#4285f4','#00e676','#ab47bc','#ff9800','#ffeb3b','#ffffff'] as const).map(c => (
                          <button
                            key={c}
                            className={`mplg__color-btn${rangeMarkColor === c ? ' mplg__color-btn--active' : ''}`}
                            title={c}
                            style={{ background: c }}
                            onClick={() => setRangeMarkColor(c)}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      className={`mplg__action-btn ${placingRangeMark ? 'mplg__action-btn--active' : ''}`}
                      title={`${rmHint} (Esc to cancel)`}
                      style={{ borderColor: rangeMarkColor, color: placingRangeMark ? rangeMarkColor : undefined }}
                      onClick={() => {
                        if (placingRangeMark) {
                          setPlacingRangeMark(false);
                          setRmp1(null); setRmp2(null); setRmpCursor(null);
                        } else {
                          setPlacingRangeMark(true);
                          setRmp1(null); setRmp2(null); setRmpCursor(null);
                        }
                      }}
                    >
                      ⊙ {rmHint}
                    </button>
                  </div>
                </div>

                <div className="mplg__sidebar-section">
                    <div className="mplg__sidebar-title">
                      {editEntityId ? 'Edit entity' : 'Place entity'}
                    </div>

                    {/* Place mode: entity selector or selected name */}
                    {!editEntityId && !placingEntity && (
                      <ComboSearch
                        items={entityItems}
                        excludeIds={excludeIds}
                        placeholder="Search creature / player…"
                        customOptions={[
                          { id: '__custom_npc__',   badge: 'Custom NPC',   badgeVariant: 'npc'   },
                          { id: '__custom_enemy__', badge: 'Custom enemy', badgeVariant: 'enemy' },
                        ]}
                        onSelect={(item) => {
                          const idStr = String(item.id);
                          if (idStr.startsWith('char-')) {
                            setPlacingEntity({ type: 'character', id: parseInt(idStr.replace('char-', '')), name: item.label });
                          } else if (idStr.startsWith('creature-')) {
                            setPlacingEntity({ type: 'creature', id: parseInt(idStr.replace('creature-', '')), name: item.label });
                          } else if (idStr === '__custom_npc__') {
                            setPlacingEntity({ type: 'custom_npc', id: 0, name: item.label });
                          } else if (idStr === '__custom_enemy__') {
                            setPlacingEntity({ type: 'custom_enemy', id: 0, name: item.label });
                          }
                          setPickedWorldPos(null);
                          setPickingLocation(false);
                          setPickingParent(false);
                        }}
                      />
                    )}
                    {!editEntityId && placingEntity && (
                      <div className="mplg__edit-name">
                        {placingEntity.name}
                      </div>
                    )}

                    {/* Edit mode: entity name */}
                    {editEntityId && (() => {
                      const ent = entities.find(e => e.id === editEntityId);
                      if (!ent) return null;
                      const name = ent.entity_type === 'character'
                        ? (characters.find(c => c.id === ent.entity_id)?.name ?? '?')
                        : ent.entity_type === 'creature'
                          ? (creatures.find(c => c.id === ent.entity_id)?.name ?? '?')
                          : (ent.label ?? '?');
                      return <div className="mplg__edit-name">{name}</div>;
                    })()}

                    {/* Shared form fields */}
                    {(placingEntity || editEntityId) && (
                      <div className="mplg__form-fields">

                        {/* Scale */}
                        <div className="mplg__form-row">
                          <span className="mplg__form-label">Scale</span>
                          <input
                            type="number"
                            className="mplg__num-input"
                            min={0}
                            step="any"
                            value={placeScaleInput}
                            onChange={e => {
                              setPlaceScaleInput(e.target.value);
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0) setPlaceScale(v);
                            }}
                            onBlur={() => {
                              const v = parseFloat(placeScaleInput);
                              if (isNaN(v) || v < 0) setPlaceScaleInput(String(placeScale));
                            }}
                          />
                        </div>

                        {/* Parent */}
                        <div className="mplg__form-row">
                          <span className="mplg__form-label">Parent</span>
                          <span className="mplg__form-value">
                            {placeParentName || (placeParentPath ? '…' : 'any')}
                          </span>
                          {placeParentPath && (
                            <button
                              className="mplg__clear-btn"
                              title="Clear parent"
                              onClick={() => { setPlaceParentPath(null); setPlaceParentName(''); }}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        {/* Set parent image button */}
                        <button
                          className={`mplg__action-btn ${pickingParent ? 'mplg__action-btn--active' : ''}`}
                          onClick={() => { setPickingParent(v => !v); setPickingLocation(false); }}
                        >
                          <Layers size={13} />
                          {pickingParent ? 'Click on image…' : 'Set parent image'}
                        </button>

                        {/* Pick location button */}
                        <button
                          className={`mplg__action-btn ${pickingLocation ? 'mplg__action-btn--active' : ''}`}
                          onClick={() => { setPickingLocation(v => !v); setPickingParent(false); }}
                        >
                          <MapPin size={13} />
                          {pickingLocation
                            ? 'Click on map…'
                            : editEntityId
                              ? 'Move on map'
                              : pickedWorldPos
                                ? '✓ Location set'
                                : 'Pick location'}
                        </button>

                        {/* Place mode: Add + Cancel buttons */}
                        {!editEntityId && placingEntity && (
                          <div className="mplg__form-row-btns">
                            <button
                              className="mplg__btn mplg__btn--accent"
                              disabled={!pickedWorldPos}
                              onClick={handleAddEntity}
                            >
                              <Plus size={13} /> Add
                            </button>
                            <button className="mplg__btn" onClick={resetForm}>
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* Edit mode: Save + Cancel */}
                        {editEntityId && (
                          <div className="mplg__form-row-btns">
                            <button className="mplg__btn mplg__btn--accent" onClick={handleSaveEntity}>
                              Save
                            </button>
                            <button className="mplg__btn" onClick={resetForm}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Entity list */}
                  <div className="mplg__sidebar-list">
                    <div className="mplg__sidebar-title mplg__sidebar-title--sm">Placed</div>
                    {entities.length > 3 && (
                      <input
                        className="mplg__filter-input"
                        placeholder="Filter…"
                        value={entityFilter}
                        onChange={e => setEntityFilter(e.target.value)}
                      />
                    )}
                    <div className="mplg__entity-scroll">
                    {entities.length === 0 && (
                      <div className="mplg__no-entities">Nothing placed yet</div>
                    )}
                    {entities.filter(ent => {
                      if (!entityFilter) return true;
                      const n = ent.entity_type === 'character'
                        ? (characters.find(c => c.id === ent.entity_id)?.name ?? '')
                        : ent.entity_type === 'creature'
                          ? (creatures.find(c => c.id === ent.entity_id)?.name ?? '')
                          : (ent.label ?? '');
                      return n.toLowerCase().includes(entityFilter.toLowerCase());
                    }).map(ent => {
                      const creatureType = ent.entity_type === 'character'
                        ? null
                        : ent.entity_type === 'creature'
                          ? (creatures.find(c => c.id === ent.entity_id)?.type ?? 'creature')
                          : ent.entity_type === 'custom_npc' ? 'npc' : 'enemy';
                      const name = ent.entity_type === 'character'
                        ? (characters.find(c => c.id === ent.entity_id)?.name ?? '?')
                        : ent.entity_type === 'creature'
                          ? (creatures.find(c => c.id === ent.entity_id)?.name ?? '?')
                          : (ent.label ?? '?');
                      return (
                        <div
                          key={ent.id}
                          className={`mplg__entity-item ${editEntityId === ent.id ? 'mplg__entity-item--selected' : ''}`}
                          onClick={() => handleEntityRightClick(ent)}
                        >
                          <span className={`mplg__entity-dot mplg__entity-dot--${ent.entity_type === 'character' ? 'character' : creatureType}`} />
                          <span className="mplg__entity-name">{name}</span>
                          <button
                            className="mplg__entity-del"
                            onClick={e => { e.stopPropagation(); handleDeleteEntity(ent.id); }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  </div>

                  {/* Bottom: delete map */}
                  <div className="mplg__sidebar-bottom">
                    {activeMap && (
                      confirmDeleteMap ? (
                        <div className="mplg__confirm">
                          <span className="mplg__confirm-text">Delete «{activeMap.name}»?</span>
                          <div className="mplg__confirm-btns">
                            <button className="mplg__btn mplg__btn--danger" onClick={() => { setConfirmDeleteMap(false); handleDeleteMap(); }}>
                              Yes, delete
                            </button>
                            <button className="mplg__btn" onClick={() => setConfirmDeleteMap(false)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="mplg__btn mplg__btn--danger" onClick={() => setConfirmDeleteMap(true)}>
                          <Trash2 size={13} /> Delete map
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* ── CANVAS AREA ── */}
              <div ref={canvasAreaRef} className={`mplg__canvas-area ${(pickingLocation || pickingParent || placingRangeMark) ? 'mplg__canvas-area--picking' : ''}`}>
                {isNativeFullscreen && (
                  <button className="mplg__fs-close" onClick={toggleNativeFullscreen} title="Exit fullscreen">
                    <Minimize2 size={14} />
                  </button>
                )}
                {!activeMap ? (
                  <div className="mplg__empty">
                    <p>No map uploaded yet</p>
                    {isDm && (
                      <button className="mplg__btn mplg__btn--accent" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={14} /> Upload Map JSON
                      </button>
                    )}
                  </div>
                ) : (
                  <MapEngine
                    mapData={activeMap.data}
                    viewState={activeMap.view_state}
                    onViewStateChange={isDm ? handleViewStateChange : undefined}
                    entities={entities}
                    characters={characters}
                    creatures={creatures}
                    showMarks={showMarks}
                    showMarkInfo={config.show_marks_by_default !== false}
                    showSounds
                    volumeEnabled={volumeEnabled}
                    onEntityClick={handleEntityClick}
                    onEntityRightClick={isDm && isFullscreen ? handleEntityRightClick : undefined}
                    onEntityDrag={(isDm || playersCanMove) ? handleEntityDrag : undefined}
                    onEntityDragEnd={(isDm || playersCanMove) ? handleEntityDragEnd : undefined}
                    onCanvasClick={(pickingLocation && !pickingParent) || placingRangeMark ? handleCanvasClick : undefined}
                    onPickNode={pickingParent ? handlePickNode : undefined}
                    pickingNodeMode={pickingParent}
                    clampBounds={!isDm ? clampBounds : undefined}
                    rangeMarks={rangeMarks}
                    onRangeMarkRightClick={isDm ? handleRangeMarkRightClick : undefined}
                    onRangeMarkDragEnd={isDm ? handleRangeMarkDragEnd : undefined}
                    rangePlacingPreview={rangePlacingPreview}
                    rangePlacingColor={rangeMarkColor}
                    onCanvasMouseMove={placingRangeMark ? handleCanvasMouseMove : undefined}
                    interactive
                  />
                )}
              </div>

              {/* Entity infobox overlay (shown when entity is selected on canvas) */}
              {selectedEntityInfo && (isDm || playersCanInfobox) && (
                <div className="mplg__infobox-overlay">
                  <button
                    className="mplg__infobox-close"
                    onClick={() => setSelectedEntity(null)}
                  >
                    <X size={13} />
                  </button>
                  <div className="mplg__infobox-header">
                    {selectedEntityInfo.image && (
                      <img className="mplg__infobox-img" src={selectedEntityInfo.image} alt="" />
                    )}
                    <div>
                      <div className="mplg__infobox-name">{selectedEntityInfo.name}</div>
                      <div className="mplg__infobox-meta">
                        {selectedEntityInfo.type}
                        {'level' in selectedEntityInfo && ` · Lvl ${selectedEntityInfo.level}`}
                        {'cr' in selectedEntityInfo && selectedEntityInfo.cr && ` · CR ${selectedEntityInfo.cr}`}
                      </div>
                    </div>
                  </div>
                  <div className="mplg__infobox-stats">
                    <span>HP {selectedEntityInfo.hp}</span>
                    <span>AC {selectedEntityInfo.ac}</span>
                    <span>SPD {selectedEntityInfo.speed}</span>
                    {isDm && selectedEntity && (
                      <button
                        className="mplg__infobox-del-btn"
                        title="Remove from map"
                        onClick={() => handleDeleteEntity(selectedEntity.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="mplg__infobox-actions">
                    {'sheet_image' in selectedEntityInfo && selectedEntityInfo.sheet_image && (
                      <button className="mplg__infobox-sheet-btn" title="View Sheet" onClick={() => setSheetUrl((selectedEntityInfo as { sheet_image?: string | null }).sheet_image!)}>
                        <BookOpen size={12} /> Sheet
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUploadJson} />
      </div>
      {sheetUrl && <SheetViewer url={sheetUrl} onClose={() => setSheetUrl(null)} />}
    </PluginShell>
  );
}
