import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

function Card({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [assetSummary, setAssetSummary] = useState(null);
  const [ticketSummary, setTicketSummary] = useState(null);

  useEffect(() => {
    api.get('/assets/dashboard/summary').then((r) => setAssetSummary(r.data));
    api.get('/tickets/dashboard/summary').then((r) => setTicketSummary(r.data));
  }, []);

  if (!assetSummary || !ticketSummary) return <p>Loading...</p>;

  const openTickets = ticketSummary.by_status.find((s) => s.status === 'Open')?.count || 0;
  const resolvedTickets = ticketSummary.by_status.reduce(
    (sum, s) => (['Resolved', 'Closed'].includes(s.status) ? sum + Number(s.count) : sum), 0
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card label="Total Assets" value={assetSummary.total} />
        <Card label="Open Tickets" value={openTickets} />
        <Card label="Resolved Tickets" value={resolvedTickets} />
        <Card label="Avg Resolution (hrs)" value={ticketSummary.avg_resolution_hours.toFixed(1)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-3">Assets by Status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={assetSummary.by_status} dataKey="count" nameKey="status" outerRadius={90} label>
                {assetSummary.by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-3">Assets by Location</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={assetSummary.by_location}>
              <XAxis dataKey="location" fontSize={11} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow p-5 col-span-2">
          <h2 className="font-semibold mb-3">Tickets by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ticketSummary.by_category} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="category" type="category" width={140} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
