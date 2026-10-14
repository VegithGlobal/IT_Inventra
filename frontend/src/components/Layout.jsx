import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';

const linkClass = ({ isActive }) =>
  `block px-4 py-2 rounded-lg text-sm font-medium ${
    isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
  }`;

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-white border-r px-3 py-6 flex flex-col">
        <h1 className="text-lg font-bold px-4 mb-6">IT Asset Manager</h1>
        <nav className="space-y-1 flex-1">
          <NavLink to="/" className={linkClass} end>Dashboard</NavLink>
          <NavLink to="/assets" className={linkClass}>Assets</NavLink>
          <NavLink to="/expenses" className={linkClass}>Expenses</NavLink>
          <NavLink to="/tickets" className={linkClass}>Tickets</NavLink>
          {user?.role === 'admin' && <NavLink to="/users" className={linkClass}>Users</NavLink>}
        </nav>
        <div className="px-4 border-t pt-4">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-gray-500 mb-2">{user?.role}</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-xs text-red-600 hover:underline"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
