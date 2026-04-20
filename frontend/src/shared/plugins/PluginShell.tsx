import { useState, useRef, useCallback, useContext, useLayoutEffect, useEffect } from 'react';
import { Maximize2, Minimize2, Minus, GripVertical, X } from 'lucide-react';
import { useUI } from '../../app/providers/useUI';
import { useCampaign } from '../../app/providers/useCampaign';
import { pluginIconMap, pluginLabelMap } from '../icons/pluginIcons';
import type { PluginSlug, PluginViewMode } from '../types';
import { ScreenEmbedContext } from './ScreenEmbedContext';
import './PluginShell.css';

interface PluginShellProps {
  slug: PluginSlug;
  viewMode: PluginViewMode;
  children: React.ReactNode;
}

export default function PluginShell({ slug, viewMode, children }: PluginShellProps) {
  const isScreenEmbed = useContext(ScreenEmbedContext);
  const {
    openFullscreen, closeFullscreen, editMode,
    popupStates, popupPositions, setPopupExpanded, setPopupPosition,
  } = useUI();
  const { toggleWidgetMode, togglePopupMode, isDm, pluginConfig, sidebarPlugins } = useCampaign();
  const Icon = pluginIconMap[slug];
  const label = pluginLabelMap[slug];

  /* ── Per-plugin config flags ── */
  const config = pluginConfig(slug);
  // Fullscreen available if this plugin is in the sidebar (already accounts for DM vs player)
  const isFullscreenEnabled = sidebarPlugins.includes(slug);

  /* ── Popup drag / position state ── */
  const rootRef = useRef<HTMLElement>(null);
  // Initialize from persisted context position; fallback to null (default CSS position)
  const [popupPos, setPopupPosLocal] = useState<{ x: number; y: number } | null>(
    () => popupPositions?.[slug] ?? null,
  );
  const didDragRef = useRef(false);
  const minBtnRef  = useRef<HTMLButtonElement>(null);
  /* Stores bubble centre so the layout effect can snap the panel on mount. */
  const snapBubbleCentreRef = useRef<{ cx: number; cy: number } | null>(null);

  /* Sync local position to context (debounced via requestAnimationFrame to avoid excessive saves) */
  const setPopupPos = useCallback((pos: { x: number; y: number } | null) => {
    setPopupPosLocal(pos);
    setPopupPosition(slug, pos);
  }, [slug, setPopupPosition]);

  /* When the context position for this slug is cleared (e.g. reset button), sync local state */
  useEffect(() => {
    if ((popupPositions?.[slug] ?? null) === null) setPopupPosLocal(null);
  }, [popupPositions, slug]);

  /* After the panel mounts, align the minimise button centre with the bubble centre. */
  const popupMode = viewMode === 'popup' ? (popupStates?.[slug] ?? 'open') : null;
  useLayoutEffect(() => {
    if (popupMode !== 'open' || !snapBubbleCentreRef.current || !minBtnRef.current) return;
    const r = minBtnRef.current.getBoundingClientRect();
    const { cx, cy } = snapBubbleCentreRef.current;
    snapBubbleCentreRef.current = null;
    setPopupPos({
      x: (popupPos?.x ?? 0) + (cx - (r.left + r.width  / 2)),
      y: (popupPos?.y ?? 0) + (cy - (r.top  + r.height / 2)),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupMode]);

  const startPopupDrag = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const sx = rect.left, sy = rect.top;
    const mx0 = e.clientX, my0 = e.clientY;
    didDragRef.current = false;
    const onMove = (ev: MouseEvent) => {
      didDragRef.current = true;
      setPopupPos({ x: sx + ev.clientX - mx0, y: sy + ev.clientY - my0 });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  /* ════════════════════════════════════════
     POPUP MODE — bubble or open panel
  ════════════════════════════════════════ */
  if (viewMode === 'popup') {
    /* Screen-embed bypass: render raw children without popup chrome */
    if (isScreenEmbed) {
      return <div className="scr-plugin-embed">{children}</div>;
    }
    const popupMode = popupStates?.[slug] ?? 'open';
    const popupStyle: React.CSSProperties = popupPos
      ? { position: 'fixed', left: popupPos.x, top: popupPos.y, bottom: 'auto', right: 'auto' }
      : {};

    /* — Bubble (minimised) — */
    if (popupMode === 'bubble') {
      return (
        <div
          ref={rootRef as React.RefObject<HTMLDivElement>}
          className={`plugin-bubble${editMode && isDm ? ' plugin-bubble--edit' : ''}`}
          style={popupStyle}
          onMouseDown={startPopupDrag}
          title={label}
        >
          <button
            className="plugin-bubble__icon"
            onClick={(e) => {
              e.stopPropagation();
              if (!didDragRef.current) {
                if (rootRef.current) {
                  const r = rootRef.current.getBoundingClientRect();
                  const cx = r.left + r.width  / 2;
                  const cy = r.top  + r.height / 2;
                  /* Store bubble centre; layout effect will snap after panel mounts. */
                  snapBubbleCentreRef.current = { cx, cy };
                  /* Rough initial position so panel appears near bubble (layout effect corrects it). */
                  setPopupPos({ x: cx - 336, y: cy - 20 });
                }
                setPopupExpanded(slug, true);
              }
            }}
          >
            <Icon size={22} />
          </button>
          {/* Close bubble — edit mode only: disables popup mode for this plugin */}
          {editMode && isDm && (
            <button
              className="plugin-bubble__close"
              title="Remove popup"
              onClick={(e) => { e.stopPropagation(); togglePopupMode(slug, false); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X size={9} />
            </button>
          )}
        </div>
      );
    }

    /* — Open panel — */
    const scale = typeof config?.popup_scale === 'number' ? config.popup_scale : 1;
    const popupPanelStyle: React.CSSProperties = {
      ...popupStyle,
      ...(scale !== 1 ? {
        transform: `scale(${scale})`,
        transformOrigin: popupPos ? 'top left' : 'bottom right',
      } : {}),
    };
    return (
      <section
        ref={rootRef}
        className={`plugin plugin--popup${editMode && isDm ? ' plugin--popup-edit' : ''}`}
        style={popupPanelStyle}
        data-plugin={slug}
      >
        <header className="plugin__header plugin__header--popup-drag" onMouseDown={startPopupDrag}>
          <div className="plugin__title">
            <Icon size={16} />
            <span>{label}</span>
          </div>
          <div className="plugin__controls">
            {/* Minimise to bubble — always available */}
            <button
              ref={minBtnRef}
              className="plugin__ctrl-btn"
              title="Minimise to bubble"
              onClick={() => {
                /* Place the bubble so its centre coincides with this button's centre. */
                if (minBtnRef.current) {
                  const r = minBtnRef.current.getBoundingClientRect();
                  setPopupPos({ x: r.left + r.width / 2 - 24, y: r.top + r.height / 2 - 24 });
                }
                setPopupExpanded(slug, false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Minimize2 size={14} />
            </button>
            {/* Remove popup mode — edit mode only */}
            {editMode && isDm && (
              <button
                className="plugin__ctrl-btn plugin__ctrl-btn--edit-remove"
                title="Remove popup"
                onClick={() => togglePopupMode(slug, false)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </header>
        <div className="plugin__body">{children}</div>
      </section>
    );
  }

  /* ════════════════════════════════════════
     WIDGET / FULLSCREEN MODE
  ════════════════════════════════════════ */
  const isWidget = viewMode === 'widget';
  const canDrag  = isWidget && editMode && isDm;

  return (
    <section
      className={`plugin plugin--${viewMode}`}
      data-plugin={slug}
    >
      {/* Header */}
      <header className="plugin__header">
        {/* Drag handle — visual cue only; actual drag is handled by Dashboard wrapper */}
        {canDrag && (
          <div className="plugin__drag-handle" title="Drag to reorder">
            <GripVertical size={14} />
          </div>
        )}
        <div className="plugin__title">
          <Icon size={16} />
          <span>{label}</span>
        </div>
        <div className="plugin__controls">
          {/* Edit-mode widget controls */}
          {editMode && isDm && isWidget && (
            <button
              className="plugin__ctrl-btn plugin__ctrl-btn--remove"
              title="Remove from dashboard"
              onClick={() => toggleWidgetMode(slug, false)}
            >
              <Minus size={14} />
            </button>
          )}
          {/* Fullscreen button — only if fullscreen is enabled and not in edit mode */}
          {isWidget && isFullscreenEnabled && !editMode && (
            <button
              className="plugin__ctrl-btn"
              title="Fullscreen"
              onClick={() => openFullscreen(slug)}
            >
              <Maximize2 size={14} />
            </button>
          )}
          {viewMode === 'fullscreen' && (
            <button
              className="plugin__ctrl-btn"
              title="Exit fullscreen"
              onClick={closeFullscreen}
            >
              <Minimize2 size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="plugin__body">
        {children}
      </div>
    </section>
  );
}
