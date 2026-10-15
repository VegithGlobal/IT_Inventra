import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../api/AuthContext';

const STATUS_COLORS = {
  'In Use': 'pill-info',
  'In Stock': 'pill-success',
  'Lost': 'pill-danger',
  'Damaged': 'pill-danger',
  'Under Repair': 'pill-warning',
  'Disposed': 'pill-muted',
};

const emptyForm = {
  asset_no: '', asset_type: '', company: '', brand: '', model: '', serial_number: '',
  processor: '', ram: '', storage: '', status: 'In Stock', current_user_name: '',
  department: '', location: '', condition_report: '', remark: '',
};

export default function Assets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const canEdit = user?.role === 'admin' || user?.role === 'it_support';

  const load = () => {
    api.get('/assets', { params: { search, status } }).then((r) => setAssets(r.data));
  };

  useEffect(() => { load(); }, [search, status]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/assets', form);
    setShowForm(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Assets</h1>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : '+ Add Asset'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-6 grid grid-cols-3 gap-3">
          {Object.keys(emptyForm).map((key) => (
            key === 'status' ? (
              <select key={key} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input">
                {Object.keys(STATUS_COLORS).map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input key={key} placeholder={key.replace(/_/g, ' ')}
                value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="input" required={key === 'asset_no' || key === 'asset_type'} />
            )
          ))}
          <button className="col-span-3 btn-primary">Save Asset</button>
        </form>
      )}

      <div className="flex gap-3 mb-4">
        <input placeholder="Search asset no / brand / serial..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="input flex-1" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          <option value="">All Status</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">Asset No.</th><th>Type</th><th>Brand/Model</th>
              <th>Status</th><th>User</th><th>Location</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="table-row">
                <td className="p-3">
                  <Link to={`/assets/${a.asset_no}`} className="text-accent font-medium">{a.asset_no}</Link>
                </td>
                <td>{a.asset_type}</td>
                <td>{a.brand} {a.model}</td>
                <td><span className={`${STATUS_COLORS[a.status] || ''}`}>{a.status}</span></td>
                <td>{a.current_user_name || '-'}</td>
                <td>{a.location || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!assets.length && <p className="p-6 text-center text-fg-muted">No assets found</p>}
      </div>
    </div>
  );
}
