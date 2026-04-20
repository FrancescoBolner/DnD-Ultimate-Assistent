import { useState } from 'react';
import {
  Swords, Crown, Users, Hash, Eye, EyeOff,
  Pencil, Check, X, LogOut,
} from 'lucide-react';
import { Button, Avatar, Badge } from '../../../shared/ui';
import type { Campaign, CampaignMember } from '../../../shared/types';
import { useCampaign } from '../../../app/providers/useCampaign';
import * as campaignsApi from '../../../services/api/campaigns';
import { STATUS_LABELS } from '../constants';

/* ── Status → Badge variant map ── */
const STATUS_VARIANT: Record<Campaign['status'], 'info' | 'warning' | 'success' | 'default'> = {
  active: 'info', paused: 'warning', completed: 'success', archived: 'default',
};

/* ── Props ── */
interface CampaignCardProps {
  campaign: Campaign;
  userId: number;
  activeCampaignId: number | null;
  isExpanded: boolean;
  members: CampaignMember[];
  onToggle: () => void;
  onEnter: () => void;
  onRefresh: () => void;
}

/* ── Feature flags ── */
const SHOW_EDIT_BUTTON = false;

/* ══════════════════════════════════════════════════════════════ */
export default function CampaignCard({
  campaign: c, userId, activeCampaignId,
  isExpanded, members,
  onToggle, onEnter, onRefresh,
}: CampaignCardProps) {
  const { leaveCampaign } = useCampaign();
  const isDm      = c.dm_id === userId;
  const isPending = !isDm && c.player_status === 'invited';
  const isActive  = c.id === activeCampaignId;

  /* ── Inline campaign edit ── */
  const [editing, setEditing]     = useState(false);
  const [editName, setEditName]   = useState('');
  const [editDesc, setEditDesc]   = useState('');
  const [saving, setSaving]       = useState(false);

  function startEdit() { setEditName(c.name); setEditDesc(c.description ?? ''); setEditing(true); }
  async function saveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await campaignsApi.updateCampaign(c.id, { name: editName.trim(), description: editDesc.trim() || undefined });
      onRefresh();
      setEditing(false);
    } finally { setSaving(false); }
  }

  /* ── Leave campaign inline confirm ── */
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaving, setLeaving]           = useState(false);

  async function handleLeave() {
    setLeaving(true);
    try { await leaveCampaign(c.id); onRefresh(); }
    finally { setLeaving(false); setLeaveConfirm(false); }
  }

  /* ── Derived ── */
  const dm      = members.find(m => m.role === 'dm');
  const players = members.filter(m => m.role === 'player');

  return (
    <article className={`ccard${isActive ? ' ccard--active' : ''}`}>

      {/* ── Banner ── */}
      <div
        className={`ccard__banner ccard__banner--${c.status}`}
        style={c.image ? { backgroundImage: `url(${c.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!c.image && <Swords size={28} className="ccard__banner-icon" />}
        <Badge
          variant={STATUS_VARIANT[c.status]}
          size="sm"
          className="ccard__status-badge"
        >
          {STATUS_LABELS[c.status]}
        </Badge>
      </div>

      {/* ── Body ── */}
      <div className="ccard__body">
        {editing ? (
          /* Inline edit form */
          <div className="ccard__edit-form">
            <input
              className="ccard__edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Campaign name"
              autoFocus
            />
            <textarea
              className="ccard__edit-textarea"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Short description…"
              rows={2}
            />
            <div className="ccard__edit-actions">
              <button className="ccard__edit-cancel" onClick={() => setEditing(false)} type="button">
                <X size={12} /> Cancel
              </button>
              <button className="ccard__edit-save" onClick={saveEdit}
                disabled={saving || !editName.trim()} type="button">
                <Check size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            <div className="ccard__top">
              <h3 className="ccard__name">{c.name}</h3>
              <div className="ccard__top-actions">
                <span className={`ccard__role ${isDm ? 'role--dm' : 'role--player'}`}>
                  {isDm ? <><Crown size={11} /> DM</> : <><Users size={11} /> Player</>}
                </span>
                {SHOW_EDIT_BUTTON && isDm && (
                  <Button className="ccard__icon-btn" title="Edit" onClick={startEdit}>
                    <Pencil size={12} />
                  </Button>
                )}
              </div>
            </div>
            {c.description && <p className="ccard__desc">{c.description}</p>}
            {isDm && c.invite_code && (
              <div className="ccard__code"><Hash size={11} /><span>{c.invite_code}</span></div>
            )}
          </>
        )}

        {!isPending && (
          <button className="ccard__toggle" onClick={onToggle}>
            {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
            Members ({members.length})
          </button>
        )}
      </div>

      {/* ── Pending approval notice ── */}
      {isPending && (
        <div className="ccard__pending-notice">
          <Users size={13} />
          Waiting for DM approval to join this campaign.
        </div>
      )}

      {/* ── Collapsible details ── */}
      {isExpanded && !isPending && (
        <div className="ccard__details">

          {/* Members */}
          <div className="ccard__members">
            <p className="ccard__members-label">Members ({members.length})</p>

            {dm && (
              <div className="member-row">
                <Avatar src={dm.avatar} name={dm.username} size="xs" />
                <span className="member-row__name">{dm.username}</span>
                <span className="member-row__badge badge--dm"><Crown size={10} /> DM</span>
              </div>
            )}

            {players.map(p => (
              <div key={p.user_id} className="member-row">
                <Avatar src={p.avatar} name={p.username} size="xs" />
                <span className="member-row__name">{p.username}</span>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ── Leave confirm panel ── */}
      {leaveConfirm && (
        <div className="ccard__leave-confirm">
          <span>Leave <strong>{c.name}</strong>?</span>
          <div className="ccard__char-form-actions">
            <button className="ccard__edit-cancel" onClick={() => setLeaveConfirm(false)} type="button">
              Cancel
            </button>
            <button className="ccard__leave-btn" onClick={handleLeave} disabled={leaving} type="button">
              {leaving ? 'Leaving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="ccard__footer">
        {!isDm && !leaveConfirm && (
          <button className="ccard__leave-trigger" onClick={() => setLeaveConfirm(true)} type="button">
            <LogOut size={12} /> {isPending ? 'Cancel request' : 'Leave'}
          </button>
        )}
        <Button
          variant={isPending ? 'ghost' : 'primary'}
          size="sm"
          icon={<Swords size={13} />}
          onClick={onEnter}
          disabled={isPending}
        >
          {isPending ? 'Pending' : 'Play'}
        </Button>
      </div>

    </article>
  );
}