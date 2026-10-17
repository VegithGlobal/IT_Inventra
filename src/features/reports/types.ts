// Client-safe report shapes. Definitions (server-only) live in ./definitions.ts.

export type ReportColumnType = "text" | "number" | "money" | "date" | "datetime" | "percent";

export type ReportColumn = {
  key: string;
  label: string;
  type: ReportColumnType;
  /** Summed into the totals row (money/number columns). */
  total?: boolean;
  /** Hidden by default in the on-screen table (still exported). */
  hidden?: boolean;
  /** Optional link: row[hrefKey] holds the URL. */
  hrefKey?: string;
};

export type ReportCell = string | number | Date | null;
export type ReportRow = Record<string, ReportCell>;

export type ReportParamsSpec = {
  /** Date-range filter (YYYY-MM-DD strings), with a label for what the dates apply to. */
  dateRange?: { label: string };
  /** "Group by" choices; the first is the default. */
  groups?: { value: string; label: string }[];
  /** Single "as of" date (depreciation). */
  asOf?: boolean;
};

export type ReportParams = { from: string; to: string; group: string; asOf: string };

export type ReportMeta = {
  key: string;
  title: string;
  description: string;
  section: "Assets" | "Finance" | "Work";
  params: ReportParamsSpec;
};

export type ReportResult = {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Short line under the title, e.g. "30 assets · ₹14,32,000 book value". */
  summary?: string;
};
