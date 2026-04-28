import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../shared/ui';
import { Input } from '../../shared/ui';
import { useApp } from '../../app/providers/useApp';
import * as authApi from '../../services/api/auth';
import './Login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser, registerUser, authError } = useApp();

  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  /* ── Forgot password state ── */
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await registerUser(identifier, username, password);
      } else {
        await loginUser(identifier, password);
      }
      navigate('/home');
    } catch (err: unknown) {
      // Show only safe, generic messages — no extra info about which field failed
      const raw = err instanceof Error ? err.message : '';
      const safe = raw.includes('required') ? raw : 'Invalid credentials';
      setLocalError(safe);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotEmail.trim()) { setForgotMsg({ type: 'err', text: 'Enter your email address' }); return; }
    setForgotLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail.trim());
      // Always show the same success message regardless of whether email exists
      setForgotMsg({ type: 'ok', text: 'If that email is registered, a reset link has been sent.' });
      setForgotEmail('');
    } catch {
      setForgotMsg({ type: 'ok', text: 'If that email is registered, a reset link has been sent.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const errorMsg = localError || authError;

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__logo">
          <Swords size={36} />
          <h1 className="login__title">D&D Ultimate Assistant</h1>
        </div>

        {/* ── Forgot password form ── */}
        {showForgot ? (
          <>
            {forgotMsg && (
              <p className={`login__error ${forgotMsg.type === 'ok' ? 'login__error--ok' : ''}`}>
                {forgotMsg.text}
              </p>
            )}
            <form className="login__form" onSubmit={handleForgot}>
              <Input
                label="Email"
                type="email"
                value={forgotEmail}
                onChange={e => { setForgotEmail(e.target.value); setForgotMsg(null); }}
                placeholder="dm@example.com"
              />
              <Button variant="primary" size="lg" type="submit" style={{ width: '100%' }} disabled={forgotLoading}>
                {forgotLoading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p className="login__footer">
              Remembered it?{' '}
              <a
                href="#"
                className="login__link"
                onClick={e => { e.preventDefault(); setShowForgot(false); setForgotMsg(null); setForgotEmail(''); }}
              >
                Sign in
              </a>
            </p>
          </>
        ) : (
          <>
            {/* ── Sign in / Register form ── */}
            {errorMsg && <p className="login__error">{errorMsg}</p>}

            <form className="login__form" onSubmit={handleSubmit}>
              <Input
                label={isRegister ? 'Email' : 'Email or Username'}
                type={isRegister ? 'email' : 'text'}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder={isRegister ? 'dm@example.com' : 'dm@example.com or MasterValthor'}
              />
              {isRegister && (
                <Input
                  label="Username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="MasterValthor"
                />
              )}
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                suffix={
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              <Button variant="primary" size="lg" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            {!isRegister && (
              <p className="login__footer">
                Forgot your password?{' '}
                <a
                  href="#"
                  className="login__link"
                  onClick={e => { e.preventDefault(); setShowForgot(true); setForgotMsg(null); setForgotEmail(''); setLocalError(null); }}
                >
                  Reset password
                </a>
              </p>
            )}

            <p className="login__footer">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <a
                href="#"
                className="login__link"
                onClick={e => { e.preventDefault(); setIsRegister(v => !v); setLocalError(null); setIdentifier(''); }}
              >
                {isRegister ? 'Sign in' : 'Sign up'}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
