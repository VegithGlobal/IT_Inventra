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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">IT Asset Manager</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to continue</p>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <label className="text-sm font-medium">Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4 mt-1" required
        />
        <label className="text-sm font-medium">Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-6 mt-1" required
        />
        <button className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700">
          Log in
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Demo: admin@company.com / Admin@123
        </p>
      </form>
    </div>
  );
}
