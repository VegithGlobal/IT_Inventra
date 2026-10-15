import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';

const linkClass = ({ isActive }) =>
  `block px-4 py-2.5 rounded-full text-sm font-medium transition duration-200 ${
    isActive ? 'bg-accent text-accent-on' : 'text-fg-secondary hover:bg-card-hover hover:text-fg'
  }`;

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen gap-4 bg-app p-4">
      <aside className="w-60 shrink-0 bg-surface border border-line rounded-xl px-3 py-6 flex flex-col">
        <h1 className="text-lg font-semibold uppercase tracking-[0.04em] px-4 mb-8">
          <span className="text-accent">I</span>T Inventra
        </h1>
        <nav className="space-y-1.5 flex-1">
          <NavLink to="/" className={linkClass} end>Dashboard</NavLink>
          <NavLink to="/assets" className={linkClass}>Assets</NavLink>
          <NavLink to="/expenses" className={linkClass}>Expenses</NavLink>
          <NavLink to="/tickets" className={linkClass}>Tickets</NavLink>
          {user?.role === 'admin' && <NavLink to="/users" className={linkClass}>Users</NavLink>}
        </nav>
        <div className="mx-1 rounded-lg bg-card border border-line p-4">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-fg-muted mb-3">{user?.role}</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-xs font-medium text-danger hover:underline"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-surface border border-line rounded-xl p-6 lg:p-8">{children}</main>
    </div>
  );
}
