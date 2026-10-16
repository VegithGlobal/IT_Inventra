"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import { categoryColor } from "@/lib/options";

// Chart conventions: thin bars (≤24px) with 4px rounded data-ends, 2px surface gaps between
// stacked segments, 2px lines, light dashed horizontal grid only, text in text tokens (never
// series colours), a legend for ≥2 series, and a hover tooltip on every chart.

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthYearFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
export const monthLabel = (key: string) => monthFmt.format(new Date(`${key}-01T00:00:00Z`));
export const monthYearLabel = (key: string) => monthYearFmt.format(new Date(`${key}-01T00:00:00Z`));

/** Compact axis ticks: ₹0 / ₹50K / ₹1.2L */
function axisMoney(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}K`;
  return `₹${v}`;
}

export const axisProps = {
  tick: { fill: "var(--text-muted)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export type Series = { key: string; label: string; color: string };

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-fg-secondary">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export type TipItem = { dataKey?: unknown; value?: unknown };

export function TooltipCard({
  active,
  payload,
  label,
  series,
  title,
  showTotal,
  format = formatMoney,
  emptyText = "No spend",
}: {
  active?: boolean;
  payload?: readonly TipItem[];
  label?: unknown;
  series: Series[];
  title: (label: string) => string;
  showTotal?: boolean;
  format?: (v: number | null | undefined) => string;
  emptyText?: string;
}) {
  if (!active || !payload?.length) return null;
  const values = new Map(payload.map((p) => [String(p.dataKey), typeof p.value === "number" ? p.value : null]));
  const rows = series.filter((s) => values.get(s.key) !== undefined && values.get(s.key) !== null && values.get(s.key) !== 0);
  const total = rows.reduce((sum, s) => sum + (values.get(s.key) ?? 0), 0);
  return (
    <div className="min-w-48 rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] shadow-[var(--shadow-popover)]">
      <p className="mb-1.5 font-medium text-fg">{title(String(label))}</p>
      {rows.length === 0 && <p className="text-fg-muted">{emptyText}</p>}
      <ul className="space-y-1">
        {rows
          .slice()
          .reverse()
          .map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-fg-secondary">{s.label}</span>
              <span className="text-fg tabular">{format(values.get(s.key))}</span>
            </li>
          ))}
      </ul>
      {showTotal && rows.length > 1 && (
        <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-medium text-fg">
          <span>Total</span>
          <span className="tabular">{format(total)}</span>
        </p>
      )}
    </div>
  );
}

type BarShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: Record<string, number | string>; dataKey?: string };

/** Stacked segment with a rounded top only when it's the top non-zero segment of its column. */
function makeSegmentShape(order: string[]) {
  return function Segment(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, fill, payload, dataKey } = props as BarShapeProps;
    if (height <= 0) return <g />;
    const top = [...order].reverse().find((k) => Number(payload?.[k] ?? 0) > 0);
    const r = top === dataKey ? Math.min(4, width / 2, height) : 0;
    // 2px surface gap: shave the segment's top edge.
    const h = Math.max(0, height - 2);
    const yy = y + 2;
    const path = r
      ? `M${x},${yy + h} L${x},${yy + r} Q${x},${yy} ${x + r},${yy} L${x + width - r},${yy} Q${x + width},${yy} ${x + width},${yy + r} L${x + width},${yy + h} Z`
      : `M${x},${yy} h${width} v${h} h${-width} Z`;
    return <path d={path} fill={fill} />;
  };
}

export function SpendByMonthChart({
  data,
  categories,
}: {
  data: { month: string; byCategory: Record<string, number> }[];
  categories: { name: string; colorKey: string }[];
}) {
  const used = categories.filter((c) => data.some((d) => (d.byCategory[c.name] ?? 0) > 0));
  const series: Series[] = used.map((c) => ({ key: c.name, label: c.name, color: categoryColor(c.colorKey) }));
  const rows = data.map((d) => ({ month: d.month, ...Object.fromEntries(used.map((c) => [c.name, Math.round(d.byCategory[c.name] ?? 0)])) }));
  const Segment = makeSegmentShape(series.map((s) => s.key));
  return (
    <div className="flex flex-col gap-3">
      <Legend series={series} />
      <div className="h-72" role="img" aria-label="Monthly IT spend stacked by category. The monthly summary table below lists the same numbers.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={axisMoney} {...axisProps} width={56} />
            <Tooltip
              cursor={{ fill: "var(--bg-subtle)" }}
              content={(p) => <TooltipCard active={p.active} payload={p.payload as readonly TipItem[]} label={p.label} series={series} title={monthYearLabel} showTotal />}
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="spend" fill={s.color} maxBarSize={24} shape={Segment} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Horizontal bars, largest first, value at the tip. */
export function CategoryBreakdown({ items }: { items: { name: string; colorKey: string; total: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.total));
  const sum = items.reduce((s, i) => s + i.total, 0);
  if (!items.length) return <p className="py-8 text-center text-[13.5px] text-fg-muted">No spend in this period.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.name} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-fg-secondary">{i.name}</span>
            <span className="shrink-0 text-fg tabular">
              {formatMoneyShort(i.total)} <span className="text-fg-muted">· {Math.round((i.total / sum) * 100)}%</span>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-subtle" title={`${i.name}: ${formatMoney(i.total)}`}>
            <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.max(1.5, (i.total / max) * 100)}%`, background: categoryColor(i.colorKey) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export function YearOverYearChart({
  data,
  thisLabel,
  lastLabel,
}: {
  data: { month: string; current: number | null; previous: number }[];
  thisLabel: string;
  lastLabel: string;
}) {
  const series: Series[] = [
    { key: "previous", label: lastLabel, color: "var(--chart-2)" },
    { key: "current", label: thisLabel, color: "var(--chart-1)" },
  ];
  const rows = data.map((d, i) => ({ fyMonth: FY_MONTHS[i], current: d.current === null ? null : Math.round(d.current), previous: Math.round(d.previous) }));
  return (
    <div className="flex flex-col gap-3">
      <Legend series={[...series].reverse()} />
      <div className="h-64" role="img" aria-label={`Monthly spend, ${thisLabel} compared with ${lastLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
            <XAxis dataKey="fyMonth" {...axisProps} />
            <YAxis tickFormatter={axisMoney} {...axisProps} width={56} />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={(p) => <TooltipCard active={p.active} payload={p.payload as readonly TipItem[]} label={p.label} series={series} title={(l) => l} />}
            />
            <Line dataKey="previous" name={lastLabel} stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--bg-surface)", strokeWidth: 2 }} isAnimationActive={false} />
            <Line
              dataKey="current"
              name={thisLabel}
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--bg-surface)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
