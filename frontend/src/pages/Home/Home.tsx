import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Scroll, Filter, Users, UserPlus, X, Check, Swords } from 'lucide-react';
import { Button, SearchBar, Select } from '../../shared/ui';
import { useAuth } from '../../app/providers/useAuth';
import { useCampaign } from '../../app/providers/useCampaign';
import type { Campaign, CampaignMember } from '../../shared/types';
import TopBar from '../../shared/layout/topbar/TopBar';
import ProfileModal from './components/ProfileModal';
import CampaignCard from './components/CampaignCard';
import './Home.css';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HomePage
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    campaigns, activeCampaignId, setActiveCampaign,
    createCampaign, joinCampaign,
    getCampaignMembers,
  } = useCampaign();

  /* ── Per-campaign data cache ── */
  const [membersMap, setMembersMap] = useState<Record<number, CampaignMember[]>>({});

  const loadCampaignData = useCallback(async (cid: number) => {
    const m = await getCampaignMembers(cid).catch(() => [] as CampaignMember[]);
    setMembersMap(prev => ({ ...prev, [cid]: m }));
  }, [getCampaignMembers]);

  useEffect(() => {
    campaigns.forEach(c => {
      // Skip loading member data for campaigns where the user is only invited (not yet accepted)
      if (c.player_status !== 'invited') {
        loadCampaignData(c.id);
      }
    });
  }, [campaigns, loadCampaignData]);

  /* â”€â”€ Search / filter â”€â”€ */
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole]     = useState<string>('all');

  /* â”€â”€ Expand / collapse cards â”€â”€ */
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const toggleCard = (id: number) => setExpandedCards(prev => {
    const s = new Set(prev);
    if (s.has(id)) { s.delete(id); } else { s.add(id); }
    return s;
  });

  const filtered = useMemo(() => {
    let list = campaigns;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);
    if (filterRole !== 'all') {
      list = list.filter(c => filterRole === 'dm' ? c.dm_id === user?.id : c.dm_id !== user?.id);
    }
    return list;
  }, [campaigns, search, filterStatus, filterRole, user]);

  /* â”€â”€ Profile â”€â”€ */
  const [profileOpen, setProfileOpen] = useState(false);

  /* â”€â”€ Inline create campaign â”€â”€ */
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [createErr, setCreateErr]   = useState('');
  const [creating, setCreating]     = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { setCreateErr('Name required'); return; }
    setCreating(true); setCreateErr('');
    try {
      await createCampaign(newName.trim(), newDesc.trim());
      setShowCreate(false); setNewName(''); setNewDesc('');
    } catch (err: unknown) {
      setCreateErr(err instanceof Error ? err.message : 'Failed');
    } finally { setCreating(false); }
  }

  /* â”€â”€ Inline join campaign â”€â”€ */
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinErr, setJoinErr]   = useState('');
  const [joining, setJoining]   = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) { setJoinErr('Enter an invite code'); return; }
    setJoining(true); setJoinErr('');
    try {
      const joined = await joinCampaign(joinCode.trim().toUpperCase());
      await loadCampaignData(joined.id);
      setShowJoin(false); setJoinCode('');
    } catch (err: unknown) {
      setJoinErr(err instanceof Error ? err.message : 'Invalid code');
    } finally { setJoining(false); }
  }

  function enterCampaign(c: Campaign) { setActiveCampaign(c.id); navigate('/'); }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     Render
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  return (
    <div className="home">

      <TopBar variant="home" onUserClick={() => setProfileOpen(true)} />

      {/* â”€â”€ Page content â”€â”€ */}
      <div className="home__content">

        {/* Toolbar */}
        <div className="home__toolbar">
          <h2 className="home__title"><Scroll size={17} /> Your Campaigns</h2>
          <div className="home__toolbar-right">
            <SearchBar
              className="home__search"
              placeholder="Search campaigns"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
            <Select variant="compact" icon={<Filter size={13} />}
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
            <Select variant="compact" icon={<Users size={13} />}
              value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="dm">DM</option>
              <option value="player">Player</option>
            </Select>
            <Button variant="ghost" size="sm" icon={<UserPlus size={14} />}
              onClick={() => { setShowJoin(v => !v); setJoinErr(''); setJoinCode(''); }}>
              Join
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />}
              onClick={() => { setShowCreate(v => !v); setCreateErr(''); setNewName(''); setNewDesc(''); }}>
              New
            </Button>
          </div>
        </div>

        {/* â”€â”€ Inline join form â”€â”€ */}
        {showJoin && (
          <form className="home__inline-form" onSubmit={handleJoin}>
            <h3 className="home__inline-form__title">Join a Campaign</h3>
            <div className="home__inline-form__row">
              <input
                className="home__inline-input"
                placeholder="Invite code e.g. PHD-2026-ABCD"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value); setJoinErr(''); }}
                autoFocus
              />
              <button className="home__inline-save" type="submit" disabled={joining}>
                <Check size={13} /> {joining ? 'Joining' : 'Join'}
              </button>
              <button className="home__inline-cancel" type="button" onClick={() => setShowJoin(false)}>
                <X size={13} />
              </button>
            </div>
            {joinErr && <p className="home__inline-err">{joinErr}</p>}
          </form>
        )}

        {/* â”€â”€ Campaign grid â”€â”€ */}
        {filtered.length === 0 && !showCreate ? (
          <div className="home__empty">
            <Swords size={40} />
            <p className="home__empty-title">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
            </p>
            <p className="home__empty-sub">
              {campaigns.length === 0
                ? 'Create a campaign or join one with an invite code.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="home__grid">
            {/* Inline create form card */}
            {showCreate && (
              <article className="ccard ccard--create">
                <div className="ccard__body">
                  <form onSubmit={handleCreate} className="ccard__edit-form">
                    <h3 className="home__inline-form__title">New Campaign</h3>
                    <input
                      className="ccard__edit-input"
                      value={newName}
                      onChange={e => { setNewName(e.target.value); setCreateErr(''); }}
                      placeholder="Campaign name *"
                      autoFocus
                    />
                    <textarea
                      className="ccard__edit-textarea"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Short description"
                      rows={2}
                    />
                    {createErr && <p className="home__inline-err">{createErr}</p>}
                    <div className="ccard__edit-actions">
                      <button className="ccard__edit-cancel" type="button" onClick={() => setShowCreate(false)}>
                        <X size={12} /> Cancel
                      </button>
                      <button className="ccard__edit-save" type="submit" disabled={creating || !newName.trim()}>
                        <Check size={12} /> {creating ? 'Creating' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            )}

            {filtered.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                userId={user!.id}
                activeCampaignId={activeCampaignId}
                isExpanded={expandedCards.has(c.id)}
                members={membersMap[c.id] ?? []}
                onToggle={() => toggleCard(c.id)}
                onEnter={() => enterCampaign(c)}
                onRefresh={() => loadCampaignData(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Profile settings modal (kept intentionally it's a complex settings form) */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
