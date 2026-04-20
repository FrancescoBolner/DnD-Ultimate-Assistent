import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { Button } from '../../shared/ui';
import { Input } from '../../shared/ui';
import { useApp } from '../../app/providers/useApp';
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
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setLocalError(msg);
    } finally {
      setLoading(false);
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
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Button variant="primary" size="lg" type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

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
      </div>
    </div>
  );
}
