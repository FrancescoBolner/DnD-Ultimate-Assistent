import { useState } from 'react';
import { LayoutDashboard, Minus, Plus, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../app/providers/useApp';
import { pluginIconMap, pluginLabelMap } from '../../icons/pluginIcons';
import { supportsMode } from '../../plugins';
import type { PluginSlug } from '../../types';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const {
    allEnabledSlugs, sidebarPlugins, sidebarCollapsed,
    fullscreenPlugin, openFullscreen, closeFullscreen,
    closeAll, resetPopups, editMode, isDm,
    togglePluginFullscreen, movePlugin,
  } = useApp();

  const isHome = !fullscreenPlugin;

  /* ── Local drag state for sidebar reorder ── */
  const [draggedSlug, setDraggedSlug] = useState<PluginSlug | null>(null);
  const [dropTargetSlug, setDropTargetSlug] = useState<PluginSlug | null>(null);
  const [dropBefore, setDropBefore] = useState(false);

  /* Plugins that support fullscreen but are NOT in sidebarPlugins (removed by DM) */
  const availableForSidebar = allEnabledSlugs.filter(
    s => supportsMode(s, 'fullscreen') && !sidebarPlugins.includes(s),
  );

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`} aria-label="Main navigation">
      {/* Plugin list */}
      <nav className="sidebar__nav" aria-label="Plugins">
        {/* Home / dashboard */}
        <button
          className={`sidebar__item${isHome ? ' sidebar__item--active' : ''}`}
          onClick={() => { closeAll(); closeFullscreen(); navigate('/'); }}
          title="Dashboard"
          aria-label="Dashboard"
        >
          <LayoutDashboard size={20} />
          {!sidebarCollapsed && <span className="sidebar__label">Dashboard</span>}
        </button>

        <div className="sidebar__sep" />

        {sidebarPlugins.filter((slug: PluginSlug) => supportsMode(slug, 'fullscreen')).map((slug: PluginSlug) => {
          const Icon = pluginIconMap[slug];
          const label = pluginLabelMap[slug];
          const isActive = fullscreenPlugin === slug;
          const isDragging = draggedSlug === slug;
          const isDropTarget = dropTargetSlug === slug && !isDragging;

          return (
            <div
              key={slug}
              className={[
                'sidebar__item-wrap',
                isDragging ? 'sidebar__item-wrap--drag-source' : '',
                isDropTarget ? (dropBefore ? 'sidebar__item-wrap--drop-before' : 'sidebar__item-wrap--drop-after') : '',
              ].filter(Boolean).join(' ')}
              draggable={editMode && isDm}
              onDragStart={editMode && isDm ? (e) => {
                const el = e.currentTarget as HTMLElement;
                const ghost = el.cloneNode(true) as HTMLElement;
                ghost.style.cssText = `position:absolute;top:-9999px;left:0;width:${el.offsetWidth}px;opacity:0.9;pointer-events:none;`;
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                setTimeout(() => document.body.removeChild(ghost), 0);
                setTimeout(() => setDraggedSlug(slug), 0);
              } : undefined}
              onDragEnd={editMode && isDm ? () => {
                setDraggedSlug(null);
                setDropTargetSlug(null);
              } : undefined}
              onDragOver={editMode && isDm ? (e) => {
                e.preventDefault();
                setDropTargetSlug(slug);
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDropBefore(e.clientY < rect.top + rect.height / 2);
              } : undefined}
              onDrop={editMode && isDm ? (e) => {
                e.preventDefault();
                if (draggedSlug && draggedSlug !== slug) movePlugin(draggedSlug, slug);
                setDraggedSlug(null);
                setDropTargetSlug(null);
              } : undefined}
            >
              <button
                className={`sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
                onClick={() => { closeAll(); openFullscreen(slug); }}
                title={label}
                aria-label={label}
              >
                <Icon size={20} />
                {!sidebarCollapsed && <span className="sidebar__label">{label}</span>}
              </button>
              {/* Remove button shown in edit mode */}
              {editMode && isDm && (
                <button
                  className="sidebar__item-remove"
                  title={`Remove ${label} from sidebar`}
                  onClick={(e) => { e.stopPropagation(); togglePluginFullscreen(slug, false); }}
                >
                  <Minus size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* Edit-mode: dashed add button at bottom of list */}
        {editMode && isDm && availableForSidebar.length > 0 && (() => {
          const dropDown = availableForSidebar.length > sidebarPlugins.length * 1.5;
          return (
            <div className={`sidebar__add-item${dropDown ? ' sidebar__add-item--drop-down' : ''}`}>
              <button className="sidebar__add-btn" title="Add plugin to sidebar">
                <Plus size={16} />
                {!sidebarCollapsed && <span>Add plugin</span>}
              </button>
              <div className="sidebar__add-options">
                {availableForSidebar.map(slug => {
                  const Icon = pluginIconMap[slug];
                  return (
                    <button
                      key={slug}
                      className="sidebar__add-option"
                      onClick={() => togglePluginFullscreen(slug, true)}
                    >
                      <Icon size={14} />
                      <span>{pluginLabelMap[slug]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </nav>

      {/* ── Bottom footer: popup reset button ── */}
      <div className="sidebar__footer">
        <button
          className="sidebar__item sidebar__item--reset"
          onClick={resetPopups}
          title="Reset popup positions and states"
          aria-label="Reset popups"
        >
          <RotateCcw size={18} />
          {!sidebarCollapsed && <span className="sidebar__label">Reset popups</span>}
        </button>
      </div>
    </aside>
  );
}
