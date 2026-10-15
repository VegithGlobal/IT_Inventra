import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <form onSubmit={submit} className="bg-surface border border-line p-8 rounded-xl shadow-float w-full max-w-sm">
        <h1 className="page-title mb-1"><span className="text-accent">I</span>T Inventra</h1>
        <p className="text-sm text-fg-secondary mb-6">Sign in to continue</p>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <label className="text-xs font-medium text-fg-secondary">Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="input w-full mb-4 mt-1" required
        />
        <label className="text-xs font-medium text-fg-secondary">Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="input w-full mb-6 mt-1" required
        />
        <button className="btn-primary w-full py-2.5">
          Log in
        </button>
        <p className="text-xs text-fg-muted mt-4">
          Demo: admin@company.com / Admin@123
        </p>
      </form>
    </div>
  );
}
