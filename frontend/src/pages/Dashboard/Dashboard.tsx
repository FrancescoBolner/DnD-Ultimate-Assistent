import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../../app/providers/useCampaign';
import { useUI }       from '../../app/providers/useUI';
import { useAuth }     from '../../app/providers/useAuth';
import { pluginRegistry, supportsMode } from '../../shared/plugins';
import { SoundboardPlugin } from '../../shared/plugins/views/soundboard/SoundboardPlugin';
import { pluginLabelMap, pluginIconMap } from '../../shared/icons/pluginIcons';
import type { PluginSlug } from '../../shared/types';
import Vault from '../../shared/layout/vault';
import Settings from '../../shared/layout/settings';
import { Plus } from 'lucide-react';
import '../../shared/plugins/plugin-placeholder.css';
import './Dashboard.css';

export default function DashboardPage() {
  const { enabledPlugins, popupEnabledSlugs, allEnabledSlugs, activeCampaignId, isDm, togglePopupMode, toggleWidgetMode, gridColumns, movePlugin } = useCampaign();
  const { fullscreenPlugin, popupStates, editMode } = useUI();
  const { authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && activeCampaignId === null) {
      navigate('/home', { replace: true });
    }
  }, [authLoading, activeCampaignId, navigate]);

  /* ── Widget drag-and-drop (live reorder) ── */
  const [draggingSlug, setDraggingSlugState] = useState<PluginSlug | null>(null);
  const [dropIdx, setDropIdxState]           = useState<number | null>(null);
  const draggingSlugRef = useRef<PluginSlug | null>(null);
  const dropIdxRef      = useRef<number | null>(null);

  const setDraggingSlug = (s: PluginSlug | null) => { draggingSlugRef.current = s; setDraggingSlugState(s); };
  const setDropIdx      = (i: number | null)      => { dropIdxRef.current = i;      setDropIdxState(i); };

  /* Base widgets (ordered from CampaignContext) that support widget mode */
  const baseWidgets = useMemo(
    () => enabledPlugins.filter(s => supportsMode(s, 'widget')),
    [enabledPlugins],
  );

  /* While dragging: live-reorder the list to show the drop preview */
  const displayWidgets = useMemo(() => {
    if (!draggingSlug || dropIdx === null) return baseWidgets;
    const without  = baseWidgets.filter(s => s !== draggingSlug);
    const clamped  = Math.min(dropIdx, without.length);
    const result   = [...without];
    result.splice(clamped, 0, draggingSlug);
    return result;
  }, [baseWidgets, draggingSlug, dropIdx]);

  /* Widgets available to add in edit mode: active in campaign, supports widget, not already in widget mode */
  const widgetAvailableToAdd = allEnabledSlugs.filter(
    s => supportsMode(s, 'widget') && !enabledPlugins.includes(s),
  );

  /* Popup FAB (edit mode only): enabled plugins not yet in popup mode */
  const popupAvailableToAdd = allEnabledSlugs.filter(
    s => supportsMode(s, 'popup') && !popupEnabledSlugs.includes(s),
  );

  // suppress unused warning — popupStates is consumed by PluginShell via context
  void popupStates;

  return (
    <>
      {/* Hidden soundboard bridge — keeps socket listeners alive even with no visible view */}
      {allEnabledSlugs.includes('soundboard') && (
        <SoundboardPlugin viewMode="hidden" />
      )}
      {/* Fullscreen plugin takes over content area */}
      {fullscreenPlugin ? (
        <div className="dashboard__fullscreen">
          {(() => {
            const Plugin = pluginRegistry[fullscreenPlugin];
            return Plugin ? <Plugin viewMode="fullscreen" /> : null;
          })()}
        </div>
      ) : (
        /* Home grid */
        <div
          className={`dashboard__grid${editMode ? ' dashboard__grid--edit' : ''}`}
          style={{
            '--grid-cols': gridColumns,
            '--widget-w': ({ 1: '320px', 2: '460px', 3: '580px', 4: '720px' } as const)[gridColumns as 1|2|3|4] ?? '460px',
          } as React.CSSProperties}
        >
          {displayWidgets.map((slug, idx) => {
            const Plugin = pluginRegistry[slug];
            if (!Plugin) return null;
            const isDragSource = slug === draggingSlug;
            return (
              <div
                key={slug}
                className={`dashboard__widget-wrap${isDragSource ? ' dashboard__widget-wrap--source' : ''}`}
                draggable={editMode && isDm}
                onDragStart={editMode && isDm ? (e) => {
                  const el = e.currentTarget as HTMLElement;
                  const ghost = el.cloneNode(true) as HTMLElement;
                  ghost.style.cssText = `position:absolute;top:-9999px;left:0;width:${el.offsetWidth}px;opacity:0.9;pointer-events:none;border-radius:10px;overflow:hidden;`;
                  document.body.appendChild(ghost);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                  setTimeout(() => document.body.removeChild(ghost), 0);
                  setTimeout(() => { setDraggingSlug(slug); setDropIdx(idx); }, 0);
                } : undefined}
                onDragEnd={editMode && isDm ? () => {
                  const dragSlug = draggingSlugRef.current;
                  const dIdx     = dropIdxRef.current;
                  if (dragSlug !== null && dIdx !== null) {
                    const without   = baseWidgets.filter(s => s !== dragSlug);
                    const clamped   = Math.min(dIdx, without.length);
                    const targetSlug = without[clamped] ?? null;
                    movePlugin(dragSlug, targetSlug);
                  }
                  setDraggingSlug(null);
                  setDropIdx(null);
                } : undefined}
                onDragOver={editMode && isDm ? (e) => {
                  e.preventDefault();
                  setDropIdx(idx);
                } : undefined}
                onDrop={editMode && isDm ? (e) => e.preventDefault() : undefined}
              >
                <Plugin viewMode="widget" />
              </div>
            );
          })}

          {/* Edit-mode: ghost add button */}
          {editMode && isDm && widgetAvailableToAdd.length > 0 && (
            <div className="dashboard__add-cell"
              onDragOver={(e) => { e.preventDefault(); setDropIdx(displayWidgets.length); }}
            >
              <Plus size={28} className="dashboard__add-icon" />
              <span className="dashboard__add-text">Add plugin</span>
              <div className="dashboard__add-options">
                {widgetAvailableToAdd.map(slug => {
                  const Icon = pluginIconMap[slug];
                  return (
                    <button key={slug} className="dashboard__add-option"
                      onClick={() => toggleWidgetMode(slug, true)}>
                      <Icon size={14} />
                      <span>{pluginLabelMap[slug]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Popup plugins — always on screen when popup mode is ON; PluginShell handles bubble/open state */}
      {popupEnabledSlugs.filter(slug => supportsMode(slug, 'popup')).map(slug => {
        const Plugin = pluginRegistry[slug];
        return Plugin ? <Plugin key={slug} viewMode="popup" /> : null;
      })}

      {/* Popup FAB — edit mode only: add popup mode to a plugin */}
      {editMode && isDm && popupAvailableToAdd.length > 0 && (
        <div className="dashboard__popup-fab">
          <button className="dashboard__popup-fab-btn" title="Add popup">
            <Plus size={20} />
          </button>
          <div className="dashboard__popup-fab-options">
            {popupAvailableToAdd.map(slug => {
              const Icon = pluginIconMap[slug];
              return (
                <button key={slug} className="dashboard__popup-fab-option"
                  onClick={() => togglePopupMode(slug, true)}>
                  <Icon size={14} />
                  <span>{pluginLabelMap[slug]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vault overlay */}
      <Vault />

      {/* Settings overlay */}
      <Settings />
    </>
  );
}
