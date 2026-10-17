import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Static server-rendered table for detail-page tabs (no sorting/paging needed). */
export function SimpleTable<T>({
  rows,
  columns,
  empty = "Nothing here yet.",
  rowKey,
}: {
  rows: T[];
  columns: { header: string; cell: (row: T) => ReactNode; align?: "right"; className?: string }[];
  empty?: ReactNode;
  rowKey: (row: T) => string;
}) {
  if (rows.length === 0) return <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-[13.5px] text-fg-muted">{empty}</div>;
  return (
    <>
      {/* Phones: cards. */}
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface sm:hidden">
        {rows.map((row) => {
          const [first, ...rest] = columns;
          return (
            <li key={rowKey(row)} className="flex flex-col gap-2 px-4 py-3">
              <div className="text-[14px] text-fg">{first.cell(row)}</div>
              {rest.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
                  {rest.map((c, i) => (
                    <div key={c.header || i} className="min-w-0">
                      {c.header && <dt className="text-fg-muted">{c.header}</dt>}
                      <dd className="truncate text-fg">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface sm:block">
      <table className="w-full text-[13.5px]">
        <thead className="bg-app">
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn("h-10 px-4 text-left text-[12px] font-medium tracking-[0.04em] whitespace-nowrap text-fg-muted uppercase", c.align === "right" && "text-right", c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="h-12 border-b border-line last:border-0 hover:bg-subtle">
              {columns.map((c) => (
                <td key={c.header} className={cn("px-4 py-2 align-middle", c.align === "right" && "text-right tabular", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
