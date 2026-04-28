import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2, Volume1, VolumeX, Plus, Pencil, Trash2,
  LayoutList, LayoutGrid, Check, X as XIcon,
  Music2, Eye, EyeOff, Search,
} from 'lucide-react';
import PluginShell from '../../PluginShell';
import { Spinner, Input, Slider, SearchBar } from '../../../ui';
import { useCampaign } from '../../../../app/providers/useCampaign';
import * as soundboardApi from '../../../../services/api/soundboard';
import {
  onSoundboardUpdated, onSoundboardPlay, onSoundboardStop,
  emitSoundPlayTrigger, emitSoundStopTrigger,
} from '../../../../services/socket';
import type { Sound, PluginViewMode } from '../../../types';
import '../plugin-view.css';
import './soundboard-plugin.css';

/* ── Draft type ─────────────────────────────────────────────── */
interface SoundDraft {
  name: string;
  url: string;
  icon: string;
  volume: number;
}
const EMPTY_DRAFT: SoundDraft = { name: '', url: '', icon: '', volume: 1 };

/* ── Volume icon helper ─────────────────────────────────────── */
function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX size={14} />;
  if (volume < 1.0) return <Volume1 size={14} />;
  return <Volume2 size={14} />;
}

/* ── Sound icon display ─────────────────────────────────────── */
function SoundIcon({ icon }: { icon: string | null }) {
  if (!icon) return <Music2 size={20} className="sb-default-icon" />;
  // If it's an emoji (short string, no http), show as text
  if (!icon.startsWith('http')) return <span className="sb-emoji-icon">{icon}</span>;
  return <img src={icon} alt="" className="sb-img-icon" />;
}

/* ── Shared playing store — keeps all mounted views in sync ─────── */
const _sbPlaying   = new Set<number>();
const _sbAudio     = new Map<number, HTMLAudioElement>();
const _sbListeners = new Set<() => void>();
function _sbNotify() { _sbListeners.forEach(fn => fn()); }
function sbPlay(sound: Sound) {
  if (_sbAudio.has(sound.id)) return;
  const audio = new Audio(sound.url);
  audio.volume = Math.min(1, Math.max(0, sound.volume));
  audio.play().catch(console.error);
  _sbAudio.set(sound.id, audio);
  audio.addEventListener('ended', () => {
    _sbAudio.delete(sound.id);
    _sbPlaying.delete(sound.id);
    _sbNotify();
  });
  _sbPlaying.add(sound.id);
  _sbNotify();
}
function sbStop(soundId: number) {
  const a = _sbAudio.get(soundId);
  if (a) { a.pause(); a.currentTime = 0; _sbAudio.delete(soundId); }
  _sbPlaying.delete(soundId);
  _sbNotify();
}
function useSharedPlaying(): Set<number> {
  const [playing, setPlaying] = useState<Set<number>>(() => new Set(_sbPlaying));
  useEffect(() => {
    // Snapshot into a new Set so React detects the reference change and re-renders
    const fn = () => setPlaying(new Set(_sbPlaying));
    _sbListeners.add(fn);
    // Audio keeps playing after unmount — do NOT clear on cleanup
    return () => { _sbListeners.delete(fn); };
  }, []);
  return playing;
}

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */
export function SoundboardPlugin({ viewMode = 'widget' }: { viewMode?: PluginViewMode }) {
  const { activeCampaignId, isDm, pluginConfig } = useCampaign();

  /* ── Plugin config (settings) ── */
  const rawConfig = pluginConfig('soundboard') ?? {};
  const playersCanManage   = Boolean(rawConfig.players_can_manage   ?? false);
  const showSearchInPopup  = Boolean(rawConfig.show_search_in_popup  ?? true);
  const playOnPlayerDevice = Boolean(rawConfig.play_on_player_device ?? false);
  const canManage = isDm || playersCanManage;

  /* ── View style (list / card) — persisted in localStorage ── */
  const VIEW_KEY   = `sb_view_${activeCampaignId}`;
  const SEARCH_KEY = `sb_search_${activeCampaignId}`;
  const [viewStyle, setViewStyleState] = useState<'list' | 'card'>(
    () => (localStorage.getItem(VIEW_KEY) as 'list' | 'card') ?? 'list',
  );
  function setViewStyle(vs: 'list' | 'card') {
    setViewStyleState(vs);
    if (activeCampaignId) localStorage.setItem(VIEW_KEY, vs);
  }

  const [searchOpen, setSearchOpenState] = useState<boolean>(
    () => localStorage.getItem(SEARCH_KEY) === '1',
  );
  function setSearchOpen(v: boolean) {
    setSearchOpenState(v);
    if (activeCampaignId) localStorage.setItem(SEARCH_KEY, v ? '1' : '0');
  }

  /* ── Data ── */
  const [sounds, setSounds]   = useState<Sound[]>([]);
  const [loading, setLoading] = useState(false);
  const soundsRef             = useRef<Sound[]>([]);
  useEffect(() => { soundsRef.current = sounds; }, [sounds]);

  /* ── Audio playback ── */
  const playing = useSharedPlaying();

  /* ── Form state ── */
  const [formOpen, setFormOpen]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [draft, setDraft]           = useState<SoundDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  /* ── Search ── */
  const [search, setSearch] = useState('');

  /* ── Load sounds ── */
  const loadSounds = useCallback(async () => {
    if (!activeCampaignId) return;
    setLoading(true);
    try {
      const list = await soundboardApi.listSounds(activeCampaignId);
      setSounds(list);
    } finally {
      setLoading(false);
    }
  }, [activeCampaignId]);

  useEffect(() => { loadSounds(); }, [loadSounds]);

  /* ── Socket listeners ── */
  useEffect(() => {
    const u1 = onSoundboardUpdated(() => loadSounds());
    const u2 = onSoundboardPlay(({ soundId, volume }) => handleRemotePlay(soundId, volume));
    const u3 = onSoundboardStop(({ soundId }) => handleRemoteStop(soundId));
    return () => { u1(); u2(); u3(); };
  }, [loadSounds]);

  /* ── Play / Stop (local + broadcast) ── */
  function handlePlay(sound: Sound) {
    if (_sbPlaying.has(sound.id)) {
      sbStop(sound.id);
      if (playOnPlayerDevice && activeCampaignId)
        emitSoundStopTrigger(activeCampaignId, sound.id);
    } else {
      sbPlay(sound);
      if (playOnPlayerDevice && activeCampaignId)
        emitSoundPlayTrigger(activeCampaignId, sound.id, sound.volume);
    }
  }

  /* ── Remote play / stop (from another client) ── */
  function handleRemotePlay(soundId: number, volume: number) {
    if (_sbAudio.has(soundId)) return;
    const sound = soundsRef.current.find(s => s.id === soundId);
    if (sound) sbPlay({ ...sound, volume });
    else { _sbPlaying.add(soundId); _sbNotify(); }
  }

  function handleRemoteStop(soundId: number) {
    sbStop(soundId);
  }

  /* ── Form helpers ── */
  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  }

  function openEdit(sound: Sound) {
    setEditingId(sound.id);
    setDraft({ name: sound.name, url: sound.url, icon: sound.icon ?? '', volume: sound.volume });
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function submitForm() {
    if (!draft.name.trim() || !draft.url.trim() || !activeCampaignId) return;
    setSubmitting(true);
    try {
      const payload = {
        name: draft.name.trim(),
        url: draft.url.trim(),
        icon: draft.icon.trim() || null,
        volume: draft.volume,
      };
      if (editingId !== null) {
        await soundboardApi.updateSound(editingId, payload);
      } else {
        await soundboardApi.createSound(activeCampaignId, payload);
      }
      cancelForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    await soundboardApi.deleteSound(id);
  }

  async function handleTogglePopup(sound: Sound) {
    // DB returns 0/1 as numbers, coerce properly
    const wasVisible = sound.show_in_popup !== false;
    await soundboardApi.updateSound(sound.id, { show_in_popup: !wasVisible });
    await loadSounds();
  }

  /* ── Sounds for popup view (show_in_popup + search filter) ── */
  const popupSounds = sounds
    .filter(s => Boolean(s.show_in_popup ?? true))
    .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()));

  /* ── Render ── */
  // Hidden mode: no UI, just keeps socket listeners + shared audio store alive
  if (viewMode === 'hidden') return null;

  const isManager = viewMode !== 'popup';

  return (
    <PluginShell slug="soundboard" viewMode={viewMode}>
      {isManager
        ? <ManagerView
            sounds={sounds}
            playing={playing}
            loading={loading}
            formOpen={formOpen}
            editingId={editingId}
            draft={draft}
            submitting={submitting}
            viewStyle={viewStyle}
            searchOpen={searchOpen}
            canManage={canManage}
            onPlay={handlePlay}
            onOpenCreate={openCreate}
            onOpenEdit={openEdit}
            onDelete={handleDelete}
            onTogglePopup={handleTogglePopup}
            onDraftChange={setDraft}
            onSubmit={submitForm}
            onCancel={cancelForm}
            onViewStyle={setViewStyle}
            onSearchOpen={setSearchOpen}
          />
        : <PlayerView
            sounds={popupSounds}
            playing={playing}
            loading={loading}
            showSearch={showSearchInPopup}
            search={search}
            onSearch={setSearch}
            onPlay={handlePlay}
          />
      }
    </PluginShell>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Manager view (widget + fullscreen)
═══════════════════════════════════════════════════════════════ */
interface ManagerViewProps {
  sounds: Sound[];
  playing: Set<number>;
  loading: boolean;
  formOpen: boolean;
  editingId: number | null;
  draft: SoundDraft;
  submitting: boolean;
  viewStyle: 'list' | 'card';
  searchOpen: boolean;
  canManage: boolean;
  onPlay: (s: Sound) => void;
  onOpenCreate: () => void;
  onOpenEdit: (s: Sound) => void;
  onDelete: (id: number) => void;
  onTogglePopup: (s: Sound) => void;
  onDraftChange: (d: SoundDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onViewStyle: (vs: 'list' | 'card') => void;
  onSearchOpen: (v: boolean) => void;
}

function ManagerView({
  sounds, playing, loading, formOpen, editingId, draft, submitting,
  viewStyle, searchOpen, canManage,
  onPlay, onOpenCreate, onOpenEdit, onDelete, onTogglePopup, onDraftChange, onSubmit, onCancel,
  onViewStyle, onSearchOpen,
}: ManagerViewProps) {
  const [search, setSearch] = useState('');
  const filteredSounds = sounds.filter(s =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="sb-manager">
      {/* Toolbar */}
      <div className="sb-toolbar">
        {canManage && (
          <button className="sb-btn sb-btn-primary" onClick={onOpenCreate}>
            <Plus size={14} /> Add Sound
          </button>
        )}
        <div className="sb-toolbar-right">
          <button
            className={`sb-icon-btn${searchOpen ? ' active' : ''}`}
            title="Search sounds"
            onClick={() => { onSearchOpen(!searchOpen); setSearch(''); }}
          ><Search size={16} /></button>
          <button
            className={`sb-icon-btn${viewStyle === 'list' ? ' active' : ''}`}
            title="List view"
            onClick={() => onViewStyle('list')}
          ><LayoutList size={16} /></button>
          <button
            className={`sb-icon-btn${viewStyle === 'card' ? ' active' : ''}`}
            title="Card view"
            onClick={() => onViewStyle('card')}
          ><LayoutGrid size={16} /></button>
        </div>
      </div>

      {/* Create / Edit form */}
      {formOpen && canManage && (
        <div className="sb-form">
          <div className="sb-form-row">
            <Input
              placeholder="Audio URL (mp3, ogg…)"
              value={draft.url}
              onChange={e => onDraftChange({ ...draft, url: e.target.value })}
              className="sb-form-url"
            />
            <Input
              placeholder="Sound name"
              value={draft.name}
              onChange={e => onDraftChange({ ...draft, name: e.target.value })}
              className="sb-form-name"
            />
          </div>
          <div className="sb-form-row">
            <Input
              placeholder="Emoji or image URL (optional)"
              value={draft.icon}
              onChange={e => onDraftChange({ ...draft, icon: e.target.value })}
              className="sb-form-icon"
            />
            <div className="sb-form-volume">
              <VolumeIcon volume={draft.volume} />
              <Slider
                min={0} max={1} step={0.05}
                value={draft.volume}
                formatValue={v => `${Math.round(v * 100)}%`}
                onChange={v => onDraftChange({ ...draft, volume: v })}
              />
            </div>
          </div>
          <div className="sb-form-actions">
            <button className="sb-btn sb-btn-ghost" onClick={onCancel}>
              <XIcon size={14} /> Cancel
            </button>
            <button
              className="sb-btn sb-btn-primary"
              onClick={onSubmit}
              disabled={submitting || !draft.name.trim() || !draft.url.trim()}
            >
              {submitting ? <Spinner size="xs" /> : <Check size={14} />}
              {editingId !== null ? 'Update Sound' : 'Add Sound'}
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      {searchOpen && (
        <SearchBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search sounds…"
          className="sb-search"
        />
      )}

      {/* Sound list */}
      {loading
        ? <div className="sb-empty"><Spinner size="sm" /></div>
        : filteredSounds.length === 0
          ? <div className="sb-empty">No sounds yet{canManage ? ' — add one above' : ''}.</div>
          : <div className={`sb-sound-list sb-${viewStyle}`}>
              {filteredSounds.map(sound => (
                <SoundItem
                  key={sound.id}
                  sound={sound}
                  isPlaying={playing.has(sound.id)}
                  viewStyle={viewStyle}
                  canManage={canManage}
                  onPlay={() => onPlay(sound)}
                  onEdit={() => onOpenEdit(sound)}
                  onDelete={() => onDelete(sound.id)}
                  onTogglePopup={canManage ? () => onTogglePopup(sound) : undefined}
                />
              ))}
            </div>
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Player view (popup)
═══════════════════════════════════════════════════════════════ */
interface PlayerViewProps {
  sounds: Sound[];
  playing: Set<number>;
  loading: boolean;
  showSearch: boolean;
  search: string;
  onSearch: (v: string) => void;
  onPlay: (s: Sound) => void;
}

function PlayerView({ sounds, playing, loading, showSearch, search, onSearch, onPlay }: PlayerViewProps) {
  return (
    <div className="sb-player">
      {showSearch && (
        <SearchBar
          value={search}
          onChange={e => onSearch(e.target.value)}
          onClear={() => onSearch('')}
          placeholder="Search sounds…"
          className="sb-search"
        />
      )}
      {loading
        ? <div className="sb-empty"><Spinner size="sm" /></div>
        : sounds.length === 0
          ? <div className="sb-empty">No sounds available.</div>
          : <div className="sb-sound-list sb-list">
              {sounds.map(sound => (
                <SoundItem
                  key={sound.id}
                  sound={sound}
                  isPlaying={playing.has(sound.id)}
                  viewStyle="list"
                  canManage={false}
                  onPlay={() => onPlay(sound)}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sound item (list & card)
═══════════════════════════════════════════════════════════════ */
interface SoundItemProps {
  sound: Sound;
  isPlaying: boolean;
  viewStyle: 'list' | 'card';
  canManage: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePopup?: () => void;
}

function SoundItem({ sound, isPlaying, viewStyle, canManage, onPlay, onEdit, onDelete, onTogglePopup }: SoundItemProps) {
  const inPopup = sound.show_in_popup !== false;
  return (
    <div
      className={`sb-sound-item${isPlaying ? ' sb-playing' : ''} sb-item-${viewStyle}`}
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPlay()}
    >
      <div className="sb-item-icon">
        <SoundIcon icon={sound.icon} />
        {isPlaying && <span className="sb-playing-ring" />}
      </div>

      <div className="sb-item-info">
        <span className="sb-item-name">{sound.name}</span>
        {onTogglePopup && (
          <button
            className={`sb-popup-toggle${inPopup ? ' sb-popup-toggle--on' : ''}`}
            title={inPopup ? 'Visible in popup — click to hide' : 'Hidden from popup — click to show'}
            onClick={e => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); onTogglePopup(); }}
          >
            {inPopup ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        )}
      </div>

      <div className="sb-item-play-state">
        {isPlaying ? <span className="sb-playing-dot" title="Playing — click to stop" /> : null}
      </div>

      {canManage && (
        <div className="sb-item-actions">
          <button
            className="sb-item-btn"
            title="Edit"
            onClick={e => { e.stopPropagation(); onEdit(); }}
          ><Pencil size={12} /></button>
          <button
            className="sb-item-btn sb-item-btn-danger"
            title="Delete"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          ><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  );
}
