import { useEffect, useState } from 'react';
import api from '../api/axios';

const CATEGORIES = ['Repair', 'Replacement', 'Purchase', 'AMC', 'Accessory', 'Other'];
const emptyForm = { asset_no: '', expense_date: '', category: 'Repair', description: '', amount: '', vendor: '', paid_by: '', department: '', location: '' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [category, setCategory] = useState('');

  const load = () => api.get('/expenses', { params: { category } }).then((r) => setExpenses(r.data));
  useEffect(() => { load(); }, [category]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/expenses', form);
    setShowForm(false);
    setForm(emptyForm);
    load();
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow p-5 mb-6 grid grid-cols-3 gap-3">
          <input placeholder="Asset No. (optional)" value={form.asset_no}
            onChange={(e) => setForm({ ...form, asset_no: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" required />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} className="border rounded-lg px-3 py-2 text-sm col-span-2" />
          <input type="number" placeholder="Amount" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" required />
          <input placeholder="Vendor" value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Paid By" value={form.paid_by}
            onChange={(e) => setForm({ ...form, paid_by: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Department" value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
          <button className="col-span-3 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">Save Expense</button>
        </form>
      )}

      <div className="flex justify-between items-center mb-4">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <p className="text-sm font-semibold">Total: ₹{total.toLocaleString()}</p>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr><th className="p-3">Date</th><th>Asset</th><th>Category</th><th>Description</th><th>Vendor</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{new Date(e.expense_date).toLocaleDateString()}</td>
                <td>{e.asset_no || '-'}</td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td>{e.vendor || '-'}</td>
                <td className="font-medium">₹{Number(e.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!expenses.length && <p className="p-6 text-center text-gray-400">No expenses found</p>}
      </div>
    </div>
  );
}
