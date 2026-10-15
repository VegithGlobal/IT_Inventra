import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Users() {
  const [users, setUsers] = useState([]);
  const load = () => api.get('/users').then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const updateRole = async (id, role) => {
    await api.put(`/users/${id}`, { role });
    load();
  };

  return (
    <div>
      <h1 className="page-title mb-6">Users</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Department</th><th>Active</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="table-row">
                <td className="p-3">{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} className="input-sm">
                    <option value="admin">admin</option>
                    <option value="it_support">it_support</option>
                    <option value="employee">employee</option>
                  </select>
                </td>
                <td>{u.department || '-'}</td>
                <td>{u.active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
