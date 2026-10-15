import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../api/AuthContext';

const CATEGORIES = ['Hardware Issue', 'Software Issue', 'New Request', 'Asset Return', 'Other'];
const STATUS_COLORS = {
  Open: 'pill-info',
  'In Progress': 'pill-warning',
  Resolved: 'pill-success',
  Closed: 'pill-muted',
};

export default function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ category: 'Hardware Issue', asset_no: '', description: '', priority: 'Medium' });
  const canManage = user?.role === 'admin' || user?.role === 'it_support';

  const load = () => api.get('/tickets', { params: { status } }).then((r) => setTickets(r.data));
  useEffect(() => { load(); }, [status]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/tickets', form);
    setShowForm(false);
    setForm({ category: 'Hardware Issue', asset_no: '', description: '', priority: 'Medium' });
    load();
  };

  const updateStatus = async (ticketNo, newStatus) => {
    await api.put(`/tickets/${ticketNo}`, { status: newStatus });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Tickets</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Raise Ticket'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-6 grid grid-cols-2 gap-3">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
            {['Low', 'Medium', 'High'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <input placeholder="Related Asset No. (optional)" value={form.asset_no}
            onChange={(e) => setForm({ ...form, asset_no: e.target.value })} className="input col-span-2" />
          <textarea placeholder="Describe the issue..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input col-span-2" rows={3} required />
          <button className="col-span-2 btn-primary">Submit Ticket</button>
        </form>
      )}

      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input mb-4">
        <option value="">All Status</option>
        {Object.keys(STATUS_COLORS).map((s) => <option key={s}>{s}</option>)}
      </select>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr><th className="p-3">Ticket #</th><th>Category</th><th>Priority</th><th>Raised By</th><th>Status</th>{canManage && <th>Update</th>}</tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="table-row">
                <td className="p-3"><Link to={`/tickets/${t.ticket_no}`} className="text-accent font-medium">{t.ticket_no}</Link></td>
                <td>{t.category}</td>
                <td>{t.priority}</td>
                <td>{t.raised_by_name}</td>
                <td><span className={`${STATUS_COLORS[t.status]}`}>{t.status}</span></td>
                {canManage && (
                  <td>
                    <select value={t.status} onChange={(e) => updateStatus(t.ticket_no, e.target.value)} className="input-sm">
                      {Object.keys(STATUS_COLORS).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!tickets.length && <p className="p-6 text-center text-fg-muted">No tickets found</p>}
      </div>
    </div>
  );
}
