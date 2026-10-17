"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/** Minimal sparkline (accent stroke, no axes). Decorative: the card shows the real number. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const w = 120;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="var(--chart-1)" opacity={0.1} />
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={3} fill="var(--chart-1)" stroke="var(--bg-surface)" strokeWidth={2} />
    </svg>
  );
}

export type DonutSlice = { key: string; label: string; value: number; color: string };

/** Part-to-whole donut with a legend (values in the legend, so colour is never the only cue). */
export function Donut({ slices, centerLabel, centerValue }: { slices: DonutSlice[]; centerLabel: string; centerValue: string }) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0" role="img" aria-label={`${centerLabel}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={0} stroke="var(--bg-surface)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const p = active && payload?.[0] ? (payload[0].payload as DonutSlice) : null;
                return p ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-[var(--shadow-popover)]">
                    <p className="flex items-center gap-2 text-fg">
                      <span className="size-2 rounded-full" style={{ background: p.color }} />
                      {p.label}
                    </p>
                    <p className="mt-0.5 text-fg-secondary tabular">
                      {p.value} · {Math.round((p.value / total) * 100)}%
                    </p>
                  </div>
                ) : null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-semibold text-fg tabular">{centerValue}</span>
          <span className="text-[12px] text-fg-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-1.5 text-[13px]">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} aria-hidden />
            <span className="flex-1 text-fg-secondary">{d.label}</span>
            <span className="text-fg tabular">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

