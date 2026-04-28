import {
  Settings, Home, BookOpen, Pencil, PanelLeft, PanelLeftClose, LogOut, Swords,
  LayoutDashboard, Minimize2, Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp }      from '../../../app/providers/useApp';
import { Button }      from '../../ui';
import { Avatar }      from '../../ui';
import './TopBar.css';

interface TopBarProps {
  /** 'dashboard' (default) = full controls; 'home' = logo + user only */
  variant?: 'dashboard' | 'home';
  /** Called when user avatar/name is clicked — use to open profile modal */
  onUserClick?: () => void;
}

export default function TopBar({ variant = 'dashboard', onUserClick }: TopBarProps) {
  const navigate = useNavigate();
  const {
    user, logout,
    activeCampaign,
    isDm,
    editMode, toggleEditMode,
    fullscreenPlugin, closeFullscreen,
    sidebarCollapsed, toggleSidebar,
    openVault, closeVault, vaultOpen,
    settingsOpen, openSettings, closeSettings,
    closeAll,
  } = useApp();

  const userPill = (
    <button
      className={`topbar__user${onUserClick ? ' topbar__user--clickable' : ''}`}
      onClick={onUserClick}
      disabled={!onUserClick}
      type="button"
    >
      <Avatar
        src={user?.avatar}
        name={user?.username ?? '?'}
        size="xs"
        shape="circle"
      />
      <span className="topbar__username">{user?.username}</span>
    </button>
  );

  /* ── Home variant ── */
  if (variant === 'home') {
    return (
      <header className="topbar topbar--home">
        <div className="topbar__left">
          <div className="topbar__logo">
            <Swords size={20} className="topbar__logo-icon" />
            <span className="topbar__logo-text">D&amp;D Ultimate Assistant</span>
          </div>
        </div>
        <div className="topbar__right">
          {userPill}
          {!!user?.is_admin && (
            <Button
              variant="ghost" size="sm"
              icon={<Shield size={14} />}
              onClick={() => navigate('/admin')}
              title="Admin panel"
            />
          )}
          <Button
            variant="ghost" size="sm"
            icon={<LogOut size={14} />}
            onClick={logout}
            title="Sign out"
          />
        </div>
      </header>
    );
  }

  /* ── Dashboard variant (default) ── */
  return (
    <header className="topbar">

      {/* ── Left: button groups separated by | dividers ── */}
      <div className="topbar__left">

        {/* Group 1: sidebar toggle */}
        <Button
          variant="ghost" size="sm"
          icon={sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        />

        <div className="topbar__sep" />

        {/* Group 2: active campaign name */}
        <span className="topbar__campaign-name">
          {activeCampaign?.name ?? 'No campaign'}
        </span>

        <div className="topbar__sep" />

        {/* Group 3: mode actions */}
        {(vaultOpen || settingsOpen) ? (
          <Button
            variant="ghost" size="sm"
            icon={<LayoutDashboard size={14} />}
            onClick={closeAll}
          >
            Back
          </Button>
        ) : fullscreenPlugin ? (
          <Button
            variant="ghost" size="sm"
            icon={<Minimize2 size={14} />}
            onClick={closeFullscreen}
          >
            Back
          </Button>
        ) : (
          isDm ? (
            <Button
              variant={editMode ? 'primary' : 'ghost'} size="sm"
              icon={<Pencil size={14} />}
              onClick={toggleEditMode}
            >
              Edit
            </Button>
          ) : (
            <Button
              variant="ghost" size="sm"
              icon={<LayoutDashboard size={14} />}
              onClick={closeAll}
            >
              Dash
            </Button>
          )
        )}
        <Button
          variant={vaultOpen ? 'primary' : 'ghost'} size="sm"
          icon={<BookOpen size={14} />}
          onClick={() => vaultOpen ? closeVault() : openVault()}

        >
          Vault
        </Button>
        <Button
          variant={settingsOpen ? 'primary' : 'ghost'} size="sm"
          icon={<Settings size={14} />}
          onClick={() => settingsOpen ? closeSettings() : openSettings()}
        >
          Settings
        </Button>
      </div>

      {/* ── Right: user identity + nav actions ── */}
      <div className="topbar__right">
        {userPill}
        <Button
          variant="ghost" size="sm"
          icon={<Home size={14} />}
          onClick={() => navigate('/home')}
          title="Home"
        />
      </div>
    </header>
  );
}
