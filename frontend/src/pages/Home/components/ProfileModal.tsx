import { useState, useEffect } from 'react';
import { Camera, Eye, EyeOff, Shield, Trash2 } from 'lucide-react';
import { Button, Input, Modal } from '../../../shared/ui';
import { useAuth } from '../../../app/providers/useAuth';
import { deleteAccount } from '../../../services/api/users';

/* ── Avatar ── */
function Avatar({ src, name, size = 'sm' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`avatar avatar--${size}`}>
      {src ? <img src={src} alt={name} className="avatar__img" /> : initials}
    </div>
  );
}
export { Avatar };

/* ── Props ── */
interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, updateProfile, logout } = useAuth();

  const [username, setUsername] = useState(user?.username ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [showPwSection, setShowPwSection] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  function reset() {
    setUsername(user?.username ?? '');
    setAvatar(user?.avatar ?? '');
    setShowPwSection(false);
    setCurPw(''); setNewPw(''); setConfirmPw('');
    setMsg(null);
    setShowDeleteSection(false);
    setDeleteConfirmText('');
    setDeleteErr('');
  }

  // Reset form when modal opens
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleProfileSave() {
    setMsg(null);
    if (!username.trim()) { setMsg({ type: 'err', text: 'Username cannot be empty' }); return; }
    try {
      await updateProfile({ username: username.trim(), avatar: avatar.trim() || undefined });
      setMsg({ type: 'ok', text: 'Profile updated!' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed' });
    }
  }

  async function handlePwSave() {
    setMsg(null);
    if (!curPw) { setMsg({ type: 'err', text: 'Enter current password' }); return; }
    if (newPw.length < 8) { setMsg({ type: 'err', text: 'Min 8 characters' }); return; }
    if (newPw !== confirmPw) { setMsg({ type: 'err', text: 'Passwords don\'t match' }); return; }
    try {
      await updateProfile({ password: curPw, newPassword: newPw });
      setMsg({ type: 'ok', text: 'Password changed!' });
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed' });
    }
  }

  async function handleDeleteAccount() {
    setDeleteErr('');
    if (!deleteConfirmText || deleteConfirmText !== user?.username) {
      setDeleteErr('Type your username exactly to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteAccount(deleteConfirmText);
      logout();
    } catch (e: unknown) {
      setDeleteErr(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleteLoading(false);
    }
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile" size="sm">
      <div className="profile-modal">

        {/* Avatar */}
        <div className="profile-modal__avatar-section">
          <div className="profile-modal__avatar-wrap">
            <Avatar src={avatar} name={username || '?'} size="lg" />
            <label className="profile-modal__avatar-btn" title="Upload image">
              <Camera size={14} />
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarFile} />
            </label>
          </div>
        </div>
        <Input
          label="Avatar URL"
          placeholder="https://…"
          value={avatar}
          onChange={e => setAvatar(e.target.value)}
        />

        {/* Username */}
        <Input
          label="Username"
          value={username}
          onChange={e => { setUsername(e.target.value); setMsg(null); }}
          placeholder="Your username"
        />

        <Button variant="primary" size="sm" style={{ width: '100%' }} onClick={handleProfileSave}>
          Save Profile
        </Button>

        <div className="profile-modal__divider" />

        {/* Password */}
        <Button
          variant="ghost" size="sm" style={{ width: '100%' }}
          icon={<Shield size={14} />}
          onClick={() => setShowPwSection(v => !v)}
        >
          Change Password
        </Button>

        {showPwSection && (
          <div className="profile-modal__pw">
            <div className="pw-field">
              <Input
                type={showCurPw ? 'text' : 'password'}
                placeholder="Current password"
                value={curPw}
                onChange={e => setCurPw(e.target.value)}
              />
              <button type="button" className="pw-eye" onClick={() => setShowCurPw(v => !v)}>
                {showCurPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="pw-field">
              <Input
                type={showNewPw ? 'text' : 'password'}
                placeholder="New password (min 8)"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
              <button type="button" className="pw-eye" onClick={() => setShowNewPw(v => !v)}>
                {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
            />
            <Button variant="secondary" size="sm" style={{ width: '100%' }} onClick={handlePwSave}>
              Change Password
            </Button>
          </div>
        )}

        {msg && (
          <p className={`profile-modal__msg ${msg.type === 'ok' ? 'msg--ok' : 'msg--err'}`}>
            {msg.text}
          </p>
        )}

        <div className="profile-modal__divider" />

        {/* Delete Account */}
        <Button
          variant="ghost" size="sm" style={{ width: '100%', color: 'var(--color-danger)' }}
          icon={<Trash2 size={14} />}
          onClick={() => { setShowDeleteSection(v => !v); setDeleteErr(''); setDeleteConfirmText(''); }}
        >
          Delete Account
        </Button>

        {showDeleteSection && (
          <div className="profile-modal__danger-zone">
            <p className="profile-modal__danger-warn">
              This will permanently delete your account and all campaigns where you are the DM.
              This action cannot be undone.
            </p>
            <Input
              placeholder={`Type your username: ${user?.username}`}
              value={deleteConfirmText}
              onChange={e => { setDeleteConfirmText(e.target.value); setDeleteErr(''); }}
            />
            {deleteErr && <p className="msg--err">{deleteErr}</p>}
            <Button
              variant="primary"
              size="sm"
              style={{ width: '100%', background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Permanently Delete My Account'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
