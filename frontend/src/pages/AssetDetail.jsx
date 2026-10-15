import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../api/AuthContext';

export default function AssetDetail() {
  const { assetNo } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [newUser, setNewUser] = useState('');
  const canEdit = user?.role === 'admin' || user?.role === 'it_support';

  const load = () => api.get(`/assets/${assetNo}`).then((r) => setAsset(r.data));
  useEffect(() => { load(); }, [assetNo]);

  const transfer = async (e) => {
    e.preventDefault();
    await api.post(`/assets/${assetNo}/transfer`, { new_user_name: newUser });
    setNewUser('');
    load();
  };

  if (!asset) return <p>Loading...</p>;

  return (
    <div>
      <Link to="/assets" className="text-sm text-accent">&larr; Back to Assets</Link>
      <h1 className="page-title mt-2 mb-6">{asset.asset_no} - {asset.brand} {asset.model}</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="card p-5 col-span-2">
          <h2 className="font-semibold mb-3">Asset Details</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-fg-secondary">Type</dt><dd>{asset.asset_type}</dd>
            <dt className="text-fg-secondary">Company</dt><dd>{asset.company || '-'}</dd>
            <dt className="text-fg-secondary">Serial No.</dt><dd>{asset.serial_number || '-'}</dd>
            <dt className="text-fg-secondary">Specs</dt><dd>{[asset.processor, asset.ram, asset.storage].filter(Boolean).join(' / ') || '-'}</dd>
            <dt className="text-fg-secondary">Status</dt><dd>{asset.status}</dd>
            <dt className="text-fg-secondary">Current User</dt><dd>{asset.current_user_name || '-'}</dd>
            <dt className="text-fg-secondary">Department</dt><dd>{asset.department || '-'}</dd>
            <dt className="text-fg-secondary">Location</dt><dd>{asset.location || '-'}</dd>
            <dt className="text-fg-secondary">Condition</dt><dd>{asset.condition_report || '-'}</dd>
            <dt className="text-fg-secondary">Remark</dt><dd>{asset.remark || '-'}</dd>
          </dl>

          {canEdit && (
            <form onSubmit={transfer} className="mt-5 pt-4 border-t flex gap-2">
              <input placeholder="Transfer to (new user name)" value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                className="input flex-1" required />
              <button className="btn-primary">Transfer</button>
            </form>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-1">Maintenance Cost</h2>
          <p className="page-title text-danger">₹{asset.total_maintenance_cost.toLocaleString()}</p>
          <p className="text-xs text-fg-muted">{asset.expenses.length} linked expense(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">User History</h2>
          <ul className="text-sm space-y-2">
            {asset.history.map((h) => (
              <li key={h.id} className="border-b pb-2">
                <span className="font-medium">{h.user_name}</span>
                <span className="text-fg-muted text-xs block">
                  {new Date(h.assigned_on).toLocaleDateString()} {h.returned_on ? `→ ${new Date(h.returned_on).toLocaleDateString()}` : '(current)'}
                </span>
              </li>
            ))}
            {!asset.history.length && <p className="text-fg-muted">No history</p>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Linked Expenses</h2>
          <ul className="text-sm space-y-2">
            {asset.expenses.map((e) => (
              <li key={e.id} className="border-b pb-2 flex justify-between">
                <span>{e.category} - {e.description}</span>
                <span className="font-medium">₹{Number(e.amount).toLocaleString()}</span>
              </li>
            ))}
            {!asset.expenses.length && <p className="text-fg-muted">No expenses linked</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
