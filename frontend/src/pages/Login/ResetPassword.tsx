import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Swords, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../../shared/ui';
import * as authApi from '../../services/api/auth';
import './Login.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!token) { setMsg({ type: 'err', text: 'Invalid or missing reset token.' }); return; }
    if (password.length < 6) { setMsg({ type: 'err', text: 'Password must be at least 6 characters.' }); return; }
    if (password !== confirm) { setMsg({ type: 'err', text: 'Passwords do not match.' }); return; }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setMsg({ type: 'ok', text: 'Password updated! Redirecting to login…' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      // Expose the token-invalid error since it's not sensitive
      setMsg({ type: 'err', text: raw || 'Failed to reset password. The link may have expired.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__logo">
          <Swords size={36} />
          <h1 className="login__title">D&amp;D Ultimate Assistant</h1>
        </div>

        <h2 className="login__subtitle">Reset Password</h2>

        {msg && <p className={`login__error ${msg.type === 'ok' ? 'login__error--ok' : ''}`}>{msg.text}</p>}

        <form className="login__form" onSubmit={handleSubmit}>
          <Input
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            suffix={
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <Input
            label="Confirm Password"
            type={showConfirm ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            suffix={
              <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <Button variant="primary" size="lg" type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Updating…' : 'Set New Password'}
          </Button>
        </form>

        <p className="login__footer">
          <a href="/login" className="login__link">Back to Sign In</a>
        </p>
      </div>
    </div>
  );
}
