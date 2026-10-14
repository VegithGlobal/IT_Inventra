import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './api/AuthContext';
import Layout from './components/Layout';
import TicketNotifications from './components/TicketNotifications';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Expenses from './pages/Expenses';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Users from './pages/Users';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/assets" element={<Protected><Assets /></Protected>} />
      <Route path="/assets/:assetNo" element={<Protected><AssetDetail /></Protected>} />
      <Route path="/expenses" element={<Protected><Expenses /></Protected>} />
      <Route path="/tickets" element={<Protected><Tickets /></Protected>} />
      <Route path="/tickets/:ticketNo" element={<Protected><TicketDetail /></Protected>} />
      <Route path="/users" element={<Protected><Users /></Protected>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TicketNotifications />
      <AppRoutes />
    </AuthProvider>
  );
}
