"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Legend, TooltipCard, axisProps, monthLabel, monthYearLabel, type Series, type TipItem } from "@/features/expenses/charts";

const SERIES: Series[] = [
  { key: "opened", label: "Opened", color: "var(--chart-1)" },
  { key: "resolved", label: "Resolved", color: "var(--chart-2)" },
];

/** Grouped columns: tickets opened vs resolved per month (one axis, same unit). */
export function TicketsPerMonthChart({ data }: { data: { month: string; opened: number; resolved: number }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Legend series={SERIES} />
      <div className="h-64" role="img" aria-label="Tickets opened and resolved per month, last 12 months">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} {...axisProps} width={32} />
            <Tooltip
              cursor={{ fill: "var(--bg-subtle)" }}
              content={(p) => (
                <TooltipCard
                  active={p.active}
                  payload={p.payload as readonly TipItem[]}
                  label={p.label}
                  series={SERIES}
                  title={monthYearLabel}
                  format={(v) => String(v ?? 0)}
                  emptyText="No tickets"
                />
              )}
            />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
