import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { ReportCell, ReportColumn, ReportRow } from "./types";

export function formatCell(type: ReportColumn["type"], v: ReportCell): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "money":
      return formatMoney(v as number);
    case "number":
      return typeof v === "number" ? (Number.isInteger(v) ? formatNumber(v) : v.toFixed(1)) : String(v);
    case "percent":
      return `${Math.round((v as number) * 100)}%`;
    case "date":
      return formatDate(v as Date);
    case "datetime":
      return formatDateTime(v as Date);
    default:
      return String(v);
  }
}

export function totalsOf(columns: ReportColumn[], rows: ReportRow[]) {
  return Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, rows.reduce((s, r) => s + (typeof r[c.key] === "number" ? (r[c.key] as number) : 0), 0)]));
}
