import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Shield, Users, Swords, BarChart3, UserCheck, UserX,
  ShieldCheck, ShieldOff, Search, Copy, Check, FolderOpen,
  ChevronUp, ChevronDown, ArrowUpDown, Image as ImageIcon, X,
  Database, Download, Upload, AlertCircle, CheckCircle2,
  LayoutGrid, List, Music, FileQuestion,
} from 'lucide-react';
import { useAuth } from '../../app/providers/useAuth';
import * as adminApi from '../../services/api/admin';
import type { AdminUser, AdminCampaign, PlatformStats, AdminImage } from '../../services/api/admin';
import './Admin.css';

type Tab = 'stats' | 'users' | 'campaigns' | 'images' | 'database';
type SortDir = 'asc' | 'desc';

function sortArr<T>(arr: T[], key: keyof T, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av;
    }
    return 0;
  });
}

/* ── Copy-to-clipboard hook ── */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(null), 1800);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        // fallback for non-secure contexts (LAN access without HTTPS)
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        done();
      });
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      done();
    }
  }, []);
  return { copy, copied };
}

/* ════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('stats');

  if (!user?.is_admin) {
    return (
      <div className="admin">
        <div className="admin__denied">
          <Shield size={48} />
          <h2>Access Denied</h2>
          <p>You must be an admin to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <h1 className="admin__title"><Shield size={20} /> Admin Panel</h1>
        <nav className="admin__tabs">
          {([['stats', 'Stats', BarChart3], ['users', 'Users', Users], ['campaigns', 'Campaigns', Swords], ['images', 'Images', ImageIcon], ['database', 'Database', Database]] as const).map(
            ([key, label, Icon]) => (
              <button key={key} className={`admin__tab ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key as Tab)}>
                <Icon size={14} /> {label}
              </button>
            ),
          )}
        </nav>
      </header>

      <div className="admin__body">
        {tab === 'stats'     && <StatsPanel />}
        {tab === 'users'     && <UsersPanel currentUserId={user.id} />}
        {tab === 'campaigns' && <CampaignsPanel />}
        {tab === 'images'    && <ImagesPanel />}
        {tab === 'database'  && <DatabasePanel />}
      </div>
    </div>
  );
}

/* ── Stats Panel ── */
function StatsPanel() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  useEffect(() => { adminApi.getStats().then(setStats).catch(() => {}); }, []);

  if (!stats) return <p className="admin__loading">Loading stats…</p>;

  const cards = [
    { label: 'Total Users',      value: stats.total_users,      icon: Users },
    { label: 'Active Users',     value: stats.active_users,     icon: UserCheck },
    { label: 'Total Campaigns',  value: stats.total_campaigns,  icon: Swords },
    { label: 'Active Campaigns', value: stats.active_campaigns, icon: BarChart3 },
    { label: 'Characters',       value: stats.total_characters, icon: Shield },
  ];

  return (
    <div className="admin__stats-grid">
      {cards.map(c => (
        <div key={c.label} className="admin__stat-card">
          <c.icon size={20} className="admin__stat-icon" />
          <span className="admin__stat-value">{c.value}</span>
          <span className="admin__stat-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Shared sort button ── */
function SortBtn<T>({ col, sortKey, sortDir, onSort }: {
  col: keyof T;
  sortKey: keyof T;
  sortDir: SortDir;
  onSort: (col: keyof T) => void;
}) {
  const active = sortKey === col;
  return (
    <button className="admin__sort-btn" onClick={() => onSort(col)}>
      {active ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} />}
    </button>
  );
}

/* ── Users Panel ── */
function UsersPanel({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [filterAdmin, setFilterAdmin] = useState<'all' | 'admin' | 'user'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<keyof AdminUser>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await adminApi.getUsers(page);
        if (!active) return;
        setUsers(res.users);
        setTotal(res.total);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [page, version]);

  const toggleActive = async (u: AdminUser) => {
    await adminApi.toggleUserActive(u.id, !u.is_active);
    refresh();
  };
  const toggleAdmin = async (u: AdminUser) => {
    await adminApi.toggleUserAdmin(u.id, !u.is_admin);
    refresh();
  };

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || String(u.id).includes(q));
    }
    if (filterAdmin !== 'all') list = list.filter(u => filterAdmin === 'admin' ? u.is_admin : !u.is_admin);
    if (filterActive !== 'all') list = list.filter(u => filterActive === 'active' ? u.is_active : !u.is_active);
    return sortArr(list, sortKey, sortDir);
  }, [users, search, filterAdmin, filterActive, sortKey, sortDir]);

  const handleSort = (col: keyof AdminUser) => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('asc'); }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="admin__panel">
      <div className="admin__toolbar">
        <div className="admin__search-wrap">
          <Search size={13} className="admin__search-icon" />
          <input className="admin__search" placeholder="Search username, email, id…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="admin__search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <select className="admin__filter-sel" value={filterAdmin} onChange={e => setFilterAdmin(e.target.value as typeof filterAdmin)}>
          <option value="all">All roles</option>
          <option value="admin">Admin only</option>
          <option value="user">Users only</option>
        </select>
        <select className="admin__filter-sel" value={filterActive} onChange={e => setFilterActive(e.target.value as typeof filterActive)}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="admin__count">{filtered.length} / {total}</span>
      </div>

      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>ID <SortBtn<AdminUser> col="id" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Username <SortBtn<AdminUser> col="username" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Email <SortBtn<AdminUser> col="email" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Role <SortBtn<AdminUser> col="is_admin" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Status <SortBtn<AdminUser> col="is_active" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Created <SortBtn<AdminUser> col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className={!u.is_active ? 'admin__row--inactive' : ''}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`admin__badge ${u.is_admin ? 'admin__badge--admin' : 'admin__badge--user'}`}>
                    {u.is_admin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>
                  <span className={`admin__badge ${u.is_active ? 'admin__badge--active' : 'admin__badge--inactive'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="admin__actions">
                  {u.id !== currentUserId && (
                    <>
                      <button className="admin__action-btn" onClick={() => toggleActive(u)}
                        title={u.is_active ? 'Deactivate' : 'Activate'}>
                        {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                      </button>
                      <button className="admin__action-btn" onClick={() => toggleAdmin(u)}
                        title={u.is_admin ? 'Remove admin' : 'Make admin'}>
                        {u.is_admin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin__pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ── Campaigns Panel ── */
function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState<keyof AdminCampaign>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await adminApi.getCampaigns(page);
        if (!active) return;
        setCampaigns(res.campaigns);
        setTotal(res.total);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [page]);

  const statuses = useMemo(() => Array.from(new Set(campaigns.map(c => c.status))).sort(), [campaigns]);

  const filtered = useMemo(() => {
    let list = campaigns;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.dm_username.toLowerCase().includes(q) || String(c.id).includes(q));
    }
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);
    return sortArr(list, sortKey, sortDir);
  }, [campaigns, search, filterStatus, sortKey, sortDir]);

  const handleSort = (col: keyof AdminCampaign) => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('asc'); }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="admin__panel">
      <div className="admin__toolbar">
        <div className="admin__search-wrap">
          <Search size={13} className="admin__search-icon" />
          <input className="admin__search" placeholder="Search name, DM, id…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="admin__search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <select className="admin__filter-sel" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="admin__count">{filtered.length} / {total}</span>
      </div>

      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>ID <SortBtn<AdminCampaign> col="id" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Name <SortBtn<AdminCampaign> col="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>DM <SortBtn<AdminCampaign> col="dm_username" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Players <SortBtn<AdminCampaign> col="player_count" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Status <SortBtn<AdminCampaign> col="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
              <th>Created <SortBtn<AdminCampaign> col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.dm_username}</td>
                <td>{c.player_count}</td>
                <td><span className={`admin__status admin__status--${c.status}`}>{c.status}</span></td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin__pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ── Images Panel ── */
const toPublicUrl = (p: string) => `http://localhost:3000/${encodeURI(p)}`; // canonical; rewriteLocalhostInJson rewrites to backend origin in production

function FileThumb({ file, onClick }: { file: AdminImage; onClick?: () => void }) {
  if (file.type === 'image') {
    return <img src={file.url} alt={file.name} className="admin__img-thumb" loading="lazy" onClick={onClick} />;
  }
  if (file.type === 'audio') {
    return <div className="admin__img-thumb admin__img-thumb--icon" onClick={onClick}><Music size={28} /></div>;
  }
  return <div className="admin__img-thumb admin__img-thumb--icon" onClick={onClick}><FileQuestion size={28} /></div>;
}

function ImagesPanel() {
  const [images, setImages] = useState<AdminImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [preview, setPreview] = useState<AdminImage | null>(null);
  const { copy, copied } = useCopy();

  useEffect(() => {
    adminApi.getImages()
      .then(setImages)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPreview(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const topFolders = useMemo(() => {
    const set = new Set(images.map(img => img.folder.split('/')[0]));
    return ['all', ...Array.from(set).sort()];
  }, [images]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return images.filter(img => {
      const matchSearch = !q ||
        img.name.toLowerCase().includes(q) ||
        img.path.toLowerCase().includes(q) ||
        img.folder.toLowerCase().includes(q);
      const matchFolder = folderFilter === 'all' || img.folder.startsWith(folderFilter);
      const matchType = typeFilter === 'all' || img.type === typeFilter;
      return matchSearch && matchFolder && matchType;
    });
  }, [images, search, folderFilter, typeFilter]);

  if (loading) return <p className="admin__loading">Scanning public files…</p>;

  return (
    <div className="admin__panel admin__panel--images">
      <div className="admin__toolbar">
        <div className="admin__search-wrap">
          <Search size={13} className="admin__search-icon" />
          <input
            className="admin__search"
            placeholder="Search by name, path, folder…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="admin__search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <select className="admin__filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="audio">Audio</option>
          <option value="other">Other</option>
        </select>
        <select className="admin__filter-sel" value={folderFilter} onChange={e => setFolderFilter(e.target.value)}>
          {topFolders.map(f => (
            <option key={f} value={f}>{f === 'all' ? 'All folders' : f}</option>
          ))}
        </select>
        <div className="admin__view-toggle">
          <button className={`admin__view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view"><LayoutGrid size={14} /></button>
          <button className={`admin__view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view"><List size={14} /></button>
        </div>
        <span className="admin__count">{filtered.length} / {images.length}</span>
      </div>

      {view === 'grid' ? (
        <div className="admin__img-grid">
          {filtered.map(img => (
            <div key={img.path} className="admin__img-card" onClick={() => setPreview(img)}>
              <div className="admin__img-thumb-wrap">
                <FileThumb file={img} />
              </div>
              <div className="admin__img-meta">
                <span className="admin__img-name" title={img.name}>{img.name}</span>
                <span className="admin__img-folder">
                  <FolderOpen size={10} /> {img.folder}
                </span>
              </div>
              <button
                className={`admin__img-copy${copied === toPublicUrl(img.path) ? ' admin__img-copy--done' : ''}`}
                title="Copy URL"
                onClick={e => { e.stopPropagation(); copy(toPublicUrl(img.path)); }}
              >
                {copied === toPublicUrl(img.path) ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Name</th>
                <th>Folder</th>
                <th>Path</th>
                <th>URL</th>
                <th>Copy</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(img => (
                <tr key={img.path}>
                  <td>
                    <FileThumb file={img} onClick={() => setPreview(img)} />
                  </td>
                  <td>{img.name}</td>
                  <td><span className="admin__folder-badge">{img.folder}</span></td>
                  <td className="admin__img-path">{img.path}</td>
                  <td className="admin__img-url">{toPublicUrl(img.path)}</td>
                  <td>
                    <button
                      className={`admin__action-btn${copied === toPublicUrl(img.path) ? ' admin__action-btn--done' : ''}`}
                      onClick={() => copy(toPublicUrl(img.path))}
                      title="Copy URL"
                    >
                      {copied === toPublicUrl(img.path) ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="admin__img-overlay" onClick={() => setPreview(null)}>
          <div className="admin__img-modal" onClick={e => e.stopPropagation()}>
            <button className="admin__img-modal-close" onClick={() => setPreview(null)}><X size={16} /></button>
            {preview.type === 'image'
              ? <img src={preview.url} alt={preview.name} className="admin__img-modal-img" />
              : preview.type === 'audio'
                ? <audio src={preview.url} controls className="admin__img-modal-audio" />
                : <div className="admin__img-modal-other"><FileQuestion size={48} /></div>
            }
            <div className="admin__img-modal-info">
              <div className="admin__img-modal-name">{preview.name}</div>
              <div className="admin__img-modal-path">{preview.path}</div>
              <div className="admin__img-modal-url">{toPublicUrl(preview.path)}</div>
              <button
                className={`admin__img-modal-copy${copied === toPublicUrl(preview.path) ? ' admin__img-modal-copy--done' : ''}`}
                onClick={() => copy(toPublicUrl(preview.path))}
              >
                {copied === toPublicUrl(preview.path) ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy URL</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Database Panel ── */
type ImportStrategy = 'ignore' | 'replace';
type DbStatus = { type: 'success' | 'error'; message: string } | null;

function DatabasePanel() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [strategy, setStrategy] = useState<ImportStrategy>('ignore');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [status, setStatus] = useState<DbStatus>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await adminApi.exportDb();
      setStatus({ type: 'success', message: 'Database exported successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setStatus({ type: 'error', message: msg });
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setStatus(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as { data?: Record<string, unknown[]> };
        const data = parsed.data ?? (parsed as unknown as Record<string, unknown[]>);
        const counts: Record<string, number> = {};
        for (const [tbl, rows] of Object.entries(data)) {
          if (Array.isArray(rows)) counts[tbl] = rows.length;
        }
        setPreview(counts);
      } catch {
        setStatus({ type: 'error', message: 'Invalid JSON file.' });
        setFile(null);
        setPreview(null);
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setImporting(true);
    setStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { data?: Record<string, unknown[]> };
      const data = (parsed.data ?? parsed) as Record<string, unknown[]>;
      const result = await adminApi.importDb(data, strategy);
      setStatus({ type: 'success', message: `Import complete — ${result.imported} rows written across ${result.tables.length} tables.` });
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setStatus({ type: 'error', message: msg });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="admin__db">
      {status && (
        <div className={`admin__db-status admin__db-status--${status.type}`}>
          {status.type === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {status.message}
          <button className="admin__db-status-close" onClick={() => setStatus(null)}><X size={13} /></button>
        </div>
      )}

      {/* Export */}
      <section className="admin__db-section">
        <h3 className="admin__db-section-title"><Download size={16} /> Export Database</h3>
        <p className="admin__db-section-desc">
          Download a full snapshot of all application data as a JSON file. This operation is read-only and non-destructive.
        </p>
        <button className="admin__db-btn admin__db-btn--export" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : <><Download size={14} /> Export to JSON</>}
        </button>
      </section>

      <div className="admin__db-divider" />

      {/* Import */}
      <section className="admin__db-section">
        <h3 className="admin__db-section-title"><Upload size={16} /> Import Database</h3>
        <p className="admin__db-section-desc">
          Upload a previously exported JSON file. Only the rows present in the file will be affected — all other data remains untouched.
        </p>

        <div className="admin__db-strategy">
          <span className="admin__db-strategy-label">Conflict strategy:</span>
          {(['ignore', 'replace'] as const).map(s => (
            <label key={s} className={`admin__db-strategy-opt${strategy === s ? ' active' : ''}`}>
              <input type="radio" name="strategy" value={s} checked={strategy === s}
                onChange={() => setStrategy(s)} />
              <strong>{s === 'ignore' ? 'Ignore' : 'Replace'}</strong>
              <span>{s === 'ignore' ? '— keep existing rows on conflict' : '— overwrite existing rows on conflict'}</span>
            </label>
          ))}
        </div>

        <label className="admin__db-file-label">
          <FolderOpen size={14} /> Choose JSON file
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange}
            className="admin__db-file-input" />
        </label>

        {preview && (
          <div className="admin__db-preview">
            <p className="admin__db-preview-title">File preview — rows to import:</p>
            <div className="admin__db-preview-grid">
              {Object.entries(preview).map(([tbl, count]) => (
                <div key={tbl} className="admin__db-preview-row">
                  <span className="admin__db-preview-table">{tbl}</span>
                  <span className="admin__db-preview-count">{count} rows</span>
                </div>
              ))}
            </div>
            <button className="admin__db-btn admin__db-btn--import" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : <><Upload size={14} /> Run Import ({strategy})</>}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
