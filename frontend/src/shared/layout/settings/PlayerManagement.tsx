import { useState, useEffect, useCallback } from 'react';
import {
  Check, X, Ban, Trash2, RotateCcw, UserCheck, Swords, UserMinus,
} from 'lucide-react';
import { Avatar, Badge } from '../../ui';
import type { BadgeVariant } from '../../ui';
import type { CampaignPlayer, Character } from '../../types';
import * as campaignsApi from '../../../services/api/campaigns';

interface Props {
  campaignId: number;
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active:  'success',
  invited: 'info',
  left:    'default',
  kicked:  'warning',
  banned:  'danger',
};

const STATUS_LABEL: Record<string, string> = {
  active:  'Active',
  invited: 'Pending',
  left:    'Left',
  kicked:  'Kicked',
  banned:  'Banned',
};

export default function PlayerManagement({ campaignId }: Props) {
  const [players,    setPlayers]    = useState<CampaignPlayer[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [busy,       setBusy]       = useState<number | null>(null);

  /* ── char-assign state ── */
  const [assignForUser,  setAssignForUser]  = useState<number | null>(null);
  const [assignCharId,   setAssignCharId]   = useState<number | ''>('');
  const [assignSaving,   setAssignSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, ch] = await Promise.all([
        campaignsApi.getCampaignPlayers(campaignId),
        campaignsApi.getCampaignCharacters(campaignId),
      ]);
      setPlayers(p);
      setCharacters(ch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  async function act(userId: number, fn: () => Promise<void>) {
    setBusy(userId);
    try { await fn(); await load(); }
    catch { /* errors surfaced by api client */ }
    finally { setBusy(null); }
  }

  async function openAssign(userId: number) {
    const cur = characters.find(c => c.player_id === userId);
    setAssignCharId(cur?.id ?? '');
    setAssignForUser(userId);
  }

  async function saveAssign() {
    if (assignForUser === null) return;
    setAssignSaving(true);
    try {
      if (assignCharId === '') {
        /* remove current assignment */
        const cur = characters.find(c => c.player_id === assignForUser);
        if (cur) await campaignsApi.setCharacterPlayer(cur.id, null);
      } else {
        await campaignsApi.setCharacterPlayer(Number(assignCharId), assignForUser);
      }
      await load();
      setAssignForUser(null);
    } finally { setAssignSaving(false); }
  }

  /* ── Derived ── */
  const active  = players.filter(p => p.status === 'active');
  const pending = players.filter(p => p.status === 'invited');
  const old     = players.filter(p => ['left', 'kicked', 'banned'].includes(p.status));

  const playerChar = (userId: number) => characters.find(c => c.player_id === userId);
  const unassignedFor = (userId: number) =>
    characters.filter(c => c.player_id === null || c.player_id === userId);

  if (loading) {
    return <div className="pm__loading">Loading players…</div>;
  }

  if (error) {
    return (
      <div className="pm__error">
        <span>Failed to load players: {error} </span>
        <button className="pm__btn pm__btn--reinvite" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pm">

      {/* ══ Active Players ══ */}
      <div className="settings__section">
        <h3 className="settings__section-heading">
          Active Players
          <span className="pm__count">{active.length}</span>
        </h3>
        <div className="settings__section-body">
          {active.length === 0
            ? <p className="pm__empty">No active players yet.</p>
            : (
              <div className="pm__table">
                {active.map(p => {
                  const char    = playerChar(p.user_id);
                  const isBusy  = busy === p.user_id;
                  return (
                    <div key={p.user_id} className="pm__row">
                      <Avatar src={p.avatar} name={p.username} size="sm" />
                      <span className="pm__name">{p.username}</span>

                      {/* Character slot */}
                      {assignForUser === p.user_id ? (
                        <div className="pm__char-assign">
                          <select
                            className="pm__char-select"
                            value={assignCharId}
                            onChange={e => setAssignCharId(e.target.value === '' ? '' : Number(e.target.value))}
                          >
                            <option value="">— Unassign —</option>
                            {unassignedFor(p.user_id).map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}{c.class ? ` (${c.class})` : ''}
                              </option>
                            ))}
                          </select>
                          <button className="pm__btn pm__btn--save" onClick={saveAssign} disabled={assignSaving}>
                            <Check size={11} />
                          </button>
                          <button className="pm__btn pm__btn--cancel" onClick={() => setAssignForUser(null)}>
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={`pm__char-pill${char ? '' : ' pm__char-pill--none'}`}
                          onClick={() => openAssign(p.user_id)}
                          title="Assign / change character"
                        >
                          <Swords size={10} />
                          {char
                            ? <>{char.name} <span className="pm__char-pill-level">Lv{char.level}</span></>
                            : 'No character'}
                        </button>
                      )}

                      <div className="pm__actions">
                        <button
                          className="pm__btn pm__btn--kick"
                          onClick={() => act(p.user_id, () => campaignsApi.kickPlayer(campaignId, p.user_id))}
                          disabled={isBusy}
                          title="Kick player"
                        >
                          <UserMinus size={12} /> Kick
                        </button>
                        <button
                          className="pm__btn pm__btn--ban"
                          onClick={() => act(p.user_id, () => campaignsApi.banPlayer(campaignId, p.user_id))}
                          disabled={isBusy}
                          title="Ban player"
                        >
                          <Ban size={12} /> Ban
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ══ Pending Players ══ */}
      <div className="settings__section">
        <h3 className="settings__section-heading">
          Pending Players
          <span className="pm__count">{pending.length}</span>
        </h3>
        <div className="settings__section-body">
          {pending.length === 0
            ? <p className="pm__empty">No pending requests.</p>
            : (
              <div className="pm__table">
                {pending.map(p => {
                  const isBusy = busy === p.user_id;
                  return (
                    <div key={p.user_id} className="pm__row">
                      <Avatar src={p.avatar} name={p.username} size="sm" />
                      <span className="pm__name">{p.username}</span>
                      <span className="pm__date">
                        Requested {new Date(p.joined_at).toLocaleDateString()}
                      </span>
                      <div className="pm__actions">
                        <button
                          className="pm__btn pm__btn--accept"
                          onClick={() => act(p.user_id, () => campaignsApi.acceptPlayer(campaignId, p.user_id))}
                          disabled={isBusy}
                          title="Accept"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          className="pm__btn pm__btn--reject"
                          onClick={() => act(p.user_id, () => campaignsApi.rejectPlayer(campaignId, p.user_id))}
                          disabled={isBusy}
                          title="Reject"
                        >
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ══ Old Players ══ */}
      <div className="settings__section">
        <h3 className="settings__section-heading">
          Past Players
          <span className="pm__count">{old.length}</span>
        </h3>
        <div className="settings__section-body">
          {old.length === 0
            ? <p className="pm__empty">No past players.</p>
            : (
              <div className="pm__table">
                {old.map(p => {
                  const isBusy = busy === p.user_id;
                  return (
                    <div key={p.user_id} className="pm__row">
                      <Avatar src={p.avatar} name={p.username} size="sm" />
                      <span className="pm__name">{p.username}</span>
                      <Badge
                        variant={STATUS_VARIANT[p.status]}
                        size="sm"
                      >
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      <div className="pm__actions">
                        {p.status === 'kicked' && (
                          <button
                            className="pm__btn pm__btn--reinvite"
                            onClick={() => act(p.user_id, () => campaignsApi.reinvitePlayer(campaignId, p.user_id))}
                            disabled={isBusy}
                            title="Re-invite to pending"
                          >
                            <UserCheck size={12} /> Re-invite
                          </button>
                        )}
                        {p.status === 'banned' && (
                          <button
                            className="pm__btn pm__btn--unban"
                            onClick={() => act(p.user_id, () => campaignsApi.unbanPlayer(campaignId, p.user_id))}
                            disabled={isBusy}
                            title="Unban player"
                          >
                            <RotateCcw size={12} /> Unban
                          </button>
                        )}
                        <button
                          className="pm__btn pm__btn--remove"
                          onClick={() => act(p.user_id, () => campaignsApi.deletePlayerEntry(campaignId, p.user_id))}
                          disabled={isBusy}
                          title="Remove from campaign history"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

    </div>
  );
}
