import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

const COLORS = ['var(--accent)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--text-muted)'];
const tooltip = {
  contentStyle: { background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 16, fontSize: 12 },
  itemStyle: { color: 'var(--text-primary)' },
  cursor: { fill: 'var(--border-subtle)' },
};
const axis = { stroke: 'var(--text-muted)', fontSize: 11, tickLine: false, axisLine: false };

function Card({ label, value, featured }) {
  return (
    <div className={featured ? 'rounded-lg bg-accent text-accent-on p-5' : 'card p-5'}>
      <p className={`text-xs font-medium uppercase tracking-wider ${featured ? 'opacity-70' : 'text-fg-muted'}`}>{label}</p>
      <p className="mt-2 text-[44px] font-light leading-none tracking-[-0.02em] tabular-nums">{value}</p>
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
      <h1 className="page-title mb-6"><span className="text-accent">D</span>ashboard</h1>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card featured label="Total Assets" value={assetSummary.total} />
        <Card label="Open Tickets" value={openTickets} />
        <Card label="Resolved Tickets" value={resolvedTickets} />
        <Card label="Avg Resolution (hrs)" value={ticketSummary.avg_resolution_hours.toFixed(1)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-[15px] font-semibold mb-3">Assets by Status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={assetSummary.by_status} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="var(--bg-card)" label>
                {assetSummary.by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-[15px] font-semibold mb-3">Assets by Location</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={assetSummary.by_location}>
              <XAxis dataKey="location" {...axis} />
              <YAxis {...axis} width={32} />
              <Tooltip {...tooltip} />
              <Bar dataKey="count" fill="var(--accent)" radius={[8, 8, 8, 8]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 col-span-2">
          <h2 className="text-[15px] font-semibold mb-3">Tickets by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ticketSummary.by_category} layout="vertical">
              <XAxis type="number" {...axis} />
              <YAxis dataKey="category" type="category" width={140} {...axis} />
              <Tooltip {...tooltip} />
              <Bar dataKey="count" fill="var(--info)" radius={[0, 8, 8, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
