"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, ListFilter, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Menu, MenuCheckboxItem, MenuContent, MenuLabel, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { downloadCsv, toCsv, type CsvValue } from "@/lib/csv";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Header used in CSV export (defaults to the string header). */
    label?: string;
    /** Value written to CSV; omit to skip the column in exports. */
    csv?: (row: TData) => CsvValue;
    align?: "right";
    className?: string;
  }
}

export type FacetFilter = { columnId: string; label: string; options: { label: string; value: string }[] };

const inSet: FilterFn<unknown> = (row, columnId, selected: string[]) =>
  !selected?.length || selected.includes(String(row.getValue(columnId)));

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Search…",
  filters = [],
  toolbar,
  bulkActions,
  exportName,
  onRowClick,
  empty,
  pageSize = 25,
  initialSorting = [],
  initialHidden = {},
  getRowId,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  searchPlaceholder?: string;
  filters?: FacetFilter[];
  toolbar?: ReactNode;
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  exportName?: string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  initialSorting?: SortingState;
  initialHidden?: VisibilityState;
  getRowId?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibility, setVisibility] = useState<VisibilityState>(initialHidden);
  const [rowSelection, setRowSelection] = useState({});
  const [facets, setFacets] = useState<Record<string, string[]>>({});

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    const withFilters = columns.map((c) => {
      const id = c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
      return filters.some((f) => f.columnId === id) ? { ...c, filterFn: inSet as FilterFn<T> } : c;
    });
    if (!bulkActions) return withFilters;
    const select: ColumnDef<T, unknown> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      meta: { className: "w-10" },
    };
    return [select, ...withFilters];
  }, [columns, filters, bulkActions]);

  const columnFilters = useMemo(
    () => Object.entries(facets).filter(([, v]) => v.length).map(([id, value]) => ({ id, value })),
    [facets],
  );

  // TanStack Table returns non-memoizable functions by design; the React Compiler lint rule flags that.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, globalFilter, columnVisibility: visibility, rowSelection, columnFilters },
    getRowId,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;
  const activeFacetCount = columnFilters.length;

  function exportCsv() {
    const cols = table.getVisibleLeafColumns().filter((c) => c.columnDef.meta?.csv);
    const headers = cols.map((c) => c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id));
    const rows = table.getSortedRowModel().rows.map((r: Row<T>) => cols.map((c) => c.columnDef.meta!.csv!(r.original)));
    downloadCsv(`${exportName}-${new Date().toISOString().slice(0, 10)}`, toCsv(headers, rows));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search table"
            className="bg-subtle pl-9 focus:bg-surface"
          />
        </div>
        {filters.map((f) => (
          <FacetChip
            key={f.columnId}
            filter={f}
            selected={facets[f.columnId] ?? []}
            onChange={(v) => setFacets((prev) => ({ ...prev, [f.columnId]: v }))}
          />
        ))}
        {(activeFacetCount > 0 || globalFilter) && (
          <button
            type="button"
            className="text-[13px] font-medium text-fg-secondary hover:text-fg"
            onClick={() => {
              setFacets({});
              setGlobalFilter("");
            }}
          >
            Clear all
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Choose columns">
                <Columns3 />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Visible columns</MenuLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <MenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                    {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                  </MenuCheckboxItem>
                ))}
            </MenuContent>
          </Menu>
          {exportName && (
            <Button size="sm" variant="ghost" onClick={exportCsv} aria-label="Export CSV">
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {bulkActions && selected.length > 0 && (
        <div className="flex items-center gap-3 border-b border-line bg-brand-soft px-4 py-2 text-[13px]">
          <span className="font-medium text-brand-text">{selected.length} selected</span>
          {bulkActions(selected, () => setRowSelection({}))}
          <button type="button" className="ml-auto text-fg-secondary hover:text-fg" onClick={() => setRowSelection({})}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-app">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line">
                {hg.headers.map((h) => {
                  const sort = h.column.getIsSorted();
                  const meta = h.column.columnDef.meta;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                      className={cn(
                        "h-10 px-4 text-left text-[12px] font-medium tracking-[0.04em] whitespace-nowrap text-fg-muted uppercase",
                        meta?.align === "right" && "text-right",
                        meta?.className,
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          className={cn("inline-flex items-center gap-1 uppercase hover:text-fg", meta?.align === "right" && "flex-row-reverse")}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort === "asc" ? <ArrowUp className="size-3.5" /> : sort === "desc" ? <ArrowDown className="size-3.5" /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                data-selected={row.getIsSelected() || undefined}
                className={cn(
                  "group h-12 border-b border-line transition-colors duration-150 last:border-0 hover:bg-subtle data-[selected]:bg-brand-soft/60",
                  onRowClick && "cursor-pointer",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-4 py-2 align-middle text-fg",
                      cell.column.columnDef.meta?.align === "right" && "text-right tabular",
                      cell.column.columnDef.meta?.className,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCount === 0 && (
          <div>
            {data.length === 0 && empty ? (
              empty
            ) : (
              <p className="px-4 py-12 text-center text-[13.5px] text-fg-muted">No results match your search or filters.</p>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredCount > 0 && (
        <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5 text-[13px] text-fg-muted">
          <span className="tabular">
            {pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min((pageIndex + 1) * table.getState().pagination.pageSize, filteredCount)} of {filteredCount}
          </span>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-1 tabular">
              {pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button size="icon-sm" variant="ghost" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FacetChip({ filter, selected, onChange }: { filter: FacetFilter; selected: string[]; onChange: (v: string[]) => void }) {
  const active = selected.length > 0;
  const summary = active
    ? selected.length === 1
      ? filter.options.find((o) => o.value === selected[0])?.label
      : `${selected.length} selected`
    : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors",
            active ? "border-brand/50 bg-brand-soft text-brand-text" : "border-dashed border-line-strong text-fg-secondary hover:bg-subtle",
          )}
        >
          <ListFilter className="size-3.5" />
          {filter.label}
          {summary && <span className="font-normal">: {summary}</span>}
          {active && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${filter.label} filter`}
              className="-mr-1 rounded p-0.5 hover:bg-brand/20"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }
              }}
            >
              <X className="size-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        {filter.options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-fg hover:bg-subtle">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v ? [...selected, o.value] : selected.filter((s) => s !== o.value))}
              />
              {o.label}
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
