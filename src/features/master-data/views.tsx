"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Archive, MapPin, MoreHorizontal, Network, Pencil, Plus, Shapes } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { FormError, InputField, TextareaField, useActionForm, useActionRunner } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { FormGrid } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { archiveDepartment, archiveLocation, saveAssetType, saveDepartment, saveLocation } from "./actions";
import type { AssetTypeRow, DepartmentRow, LocationRow } from "./queries";
import { assetTypeSchema, departmentSchema, locationSchema, type AssetTypeInput, type DepartmentInput, type LocationInput } from "./schema";

type Editing<T> = { id?: string; values: T } | null;

function RowMenu({ onEdit, onArchive }: { onEdit: () => void; onArchive?: () => void }) {
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Row actions" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}>
            <Pencil /> Edit
          </MenuItem>
          {onArchive && (
            <MenuItem danger onSelect={onArchive}>
              <Archive /> Archive
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
    </div>
  );
}

function MasterPage({
  title,
  description,
  noun,
  canWrite,
  table,
  onNew,
}: {
  title: string;
  description: string;
  noun: string;
  canWrite: boolean;
  table: ReactNode;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          canWrite && (
            <Button variant="primary" onClick={onNew}>
              <Plus />
              New {noun}
            </Button>
          )
        }
      />
      {table}
    </div>
  );
}

// ─── Departments ──────────────────────────────────────────────────────────────

function DepartmentForm({ editing, onDone }: { editing: NonNullable<Editing<DepartmentInput>>; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(departmentSchema, (data) => saveDepartment({ id: editing.id, data }), {
    defaultValues: editing.values,
    successMessage: "Department saved",
    onSuccess: onDone,
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Name" required error={errors.name?.message} {...form.register("name")} />
        <InputField label="Code" placeholder="ENG" error={errors.code?.message} {...form.register("code")} />
      </FormGrid>
      <SubmitRow pending={pending} />
    </form>
  );
}

function SubmitRow({ pending }: { pending: boolean }) {
  return (
    <div className="flex justify-end border-t border-line pt-4">
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function useArchive() {
  const { run } = useActionRunner();
  return run;
}

export function DepartmentsView({ rows, canWrite, isAdmin }: { rows: DepartmentRow[]; canWrite: boolean; isAdmin: boolean }) {
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [editing, setEditing] = useState<Editing<DepartmentInput>>(null);
  const archive = useArchive();
  const active = editing ?? (newOpen ? { values: { name: "", code: "" } } : null);
  const close = () => {
    setEditing(null);
    setNewOpen(false);
  };

  const columns: ColumnDef<DepartmentRow, unknown>[] = [
    { accessorKey: "name", header: "Department", cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>, meta: { csv: (r) => r.name } },
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-mono text-[12.5px] text-fg-secondary">{String(getValue() || "—")}</span>, meta: { csv: (r) => r.code } },
    { accessorKey: "employees", header: "Employees", meta: { align: "right", csv: (r) => r.employees } },
    { accessorKey: "assets", header: "Assets", meta: { align: "right", csv: (r) => r.assets } },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-12" },
      cell: ({ row }) =>
        canWrite && (
          <RowMenu
            onEdit={() => setEditing({ id: row.original.id, values: { name: row.original.name, code: row.original.code } })}
            onArchive={isAdmin ? () => archive(() => archiveDepartment({ id: row.original.id }), "Department archived") : undefined}
          />
        ),
    },
  ];

  return (
    <>
      <MasterPage
        title="Departments"
        description="Used on employees, assets and subscriptions."
        noun="department"
        canWrite={canWrite}
        onNew={() => setNewOpen(true)}
        table={
          <DataTable
            data={rows}
            columns={columns}
            exportName="departments"
            getRowId={(r) => r.id}
            empty={<EmptyState icon={Network} title="No departments yet" description="Add departments like Engineering, Sales or Finance." />}
          />
        }
      />
      <Modal open={!!active && canWrite} onOpenChange={(o) => !o && close()} title={active?.id ? "Edit department" : "New department"} size="sm">
        {active && <DepartmentForm editing={active} onDone={close} />}
      </Modal>
    </>
  );
}

// ─── Locations ────────────────────────────────────────────────────────────────

function LocationForm({ editing, onDone }: { editing: NonNullable<Editing<LocationInput>>; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(locationSchema, (data) => saveLocation({ id: editing.id, data }), {
    defaultValues: editing.values,
    successMessage: "Location saved",
    onSuccess: onDone,
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Name" required placeholder="Pune HQ · Floor 3" error={errors.name?.message} {...form.register("name")} />
        <InputField label="City" error={errors.city?.message} {...form.register("city")} />
      </FormGrid>
      <TextareaField label="Address" rows={2} error={errors.address?.message} {...form.register("address")} />
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...form.register("notes")} />
      <SubmitRow pending={pending} />
    </form>
  );
}

export function LocationsView({ rows, canWrite, isAdmin }: { rows: LocationRow[]; canWrite: boolean; isAdmin: boolean }) {
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [editing, setEditing] = useState<Editing<LocationInput>>(null);
  const archive = useArchive();
  const active = editing ?? (newOpen ? { values: { name: "", city: "", address: "", notes: "" } } : null);
  const close = () => {
    setEditing(null);
    setNewOpen(false);
  };

  const columns: ColumnDef<LocationRow, unknown>[] = [
    { accessorKey: "name", header: "Location", cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>, meta: { csv: (r) => r.name } },
    { accessorKey: "city", header: "City", cell: ({ getValue }) => String(getValue() || "—"), meta: { csv: (r) => r.city } },
    { accessorKey: "address", header: "Address", cell: ({ getValue }) => <span className="line-clamp-1 text-fg-secondary">{String(getValue() || "—")}</span>, meta: { csv: (r) => r.address } },
    { accessorKey: "employees", header: "Employees", meta: { align: "right", csv: (r) => r.employees } },
    { accessorKey: "assets", header: "Assets", meta: { align: "right", csv: (r) => r.assets } },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-12" },
      cell: ({ row }) =>
        canWrite && (
          <RowMenu
            onEdit={() => {
              const { id, name, city, address, notes } = row.original;
              setEditing({ id, values: { name, city, address, notes } });
            }}
            onArchive={isAdmin ? () => archive(() => archiveLocation({ id: row.original.id }), "Location archived") : undefined}
          />
        ),
    },
  ];

  return (
    <>
      <MasterPage
        title="Locations"
        description="Offices, branches, floors and rooms."
        noun="location"
        canWrite={canWrite}
        onNew={() => setNewOpen(true)}
        table={
          <DataTable
            data={rows}
            columns={columns}
            exportName="locations"
            getRowId={(r) => r.id}
            empty={<EmptyState icon={MapPin} title="No locations yet" description="Add offices or floors so you know where every asset is." />}
          />
        }
      />
      <Modal open={!!active && canWrite} onOpenChange={(o) => !o && close()} title={active?.id ? "Edit location" : "New location"}>
        {active && <LocationForm editing={active} onDone={close} />}
      </Modal>
    </>
  );
}

// ─── Asset types ──────────────────────────────────────────────────────────────

function AssetTypeForm({ editing, locked, onDone }: { editing: NonNullable<Editing<AssetTypeInput>>; locked: boolean; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(assetTypeSchema, (data) => saveAssetType({ id: editing.id, data }), {
    defaultValues: editing.values,
    successMessage: "Asset type saved",
    onSuccess: onDone,
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Name" required error={errors.name?.message} {...form.register("name")} />
        <InputField
          label="Tag prefix"
          required
          placeholder="LAP"
          readOnly={locked}
          hint={locked ? "Locked — assets already use this prefix" : "Tags look like LAP-0001"}
          error={errors.prefix?.message}
          className="[&_input]:uppercase"
          {...form.register("prefix")}
        />
        <InputField label="Useful life (months)" inputMode="numeric" required error={errors.usefulLifeMonths?.message} {...form.register("usefulLifeMonths")} />
        <InputField label="Salvage value (%)" inputMode="decimal" required error={errors.salvagePercent?.message} {...form.register("salvagePercent")} />
      </FormGrid>
      <p className="text-[12.5px] text-fg-muted">Depreciation is straight-line from purchase cost down to the salvage value over the useful life.</p>
      <SubmitRow pending={pending} />
    </form>
  );
}

export function AssetTypesView({ rows, isAdmin }: { rows: AssetTypeRow[]; isAdmin: boolean }) {
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [editing, setEditing] = useState<(NonNullable<Editing<AssetTypeInput>> & { locked: boolean }) | null>(null);
  const active = editing ?? (newOpen ? { values: { name: "", prefix: "", usefulLifeMonths: "36", salvagePercent: "5" }, locked: false } : null);
  const close = () => {
    setEditing(null);
    setNewOpen(false);
  };

  const columns: ColumnDef<AssetTypeRow, unknown>[] = [
    { accessorKey: "name", header: "Type", cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>, meta: { csv: (r) => r.name } },
    {
      accessorKey: "prefix",
      header: "Prefix",
      cell: ({ row }) => (
        <span className="font-mono text-[12.5px] text-fg-secondary">
          {row.original.prefix}-{String(row.original.nextSequence).padStart(4, "0")} <span className="text-fg-muted">next</span>
        </span>
      ),
      meta: { csv: (r) => r.prefix },
    },
    { accessorKey: "usefulLifeMonths", header: "Useful life", cell: ({ getValue }) => `${getValue()} months`, sortingFn: "alphanumeric", meta: { csv: (r) => r.usefulLifeMonths } },
    { accessorKey: "salvagePercent", header: "Salvage", cell: ({ getValue }) => `${Number(getValue())}%`, meta: { csv: (r) => r.salvagePercent } },
    { accessorKey: "assets", header: "Assets", meta: { align: "right", csv: (r) => r.assets } },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-12" },
      cell: ({ row }) =>
        isAdmin && (
          <RowMenu
            onEdit={() => {
              const { id, name, prefix, usefulLifeMonths, salvagePercent, assets } = row.original;
              setEditing({ id, values: { name, prefix, usefulLifeMonths, salvagePercent: String(Number(salvagePercent)) }, locked: assets > 0 });
            }}
          />
        ),
    },
  ];

  return (
    <>
      <MasterPage
        title="Asset types"
        description="Tag prefixes and depreciation defaults per type."
        noun="asset type"
        canWrite={isAdmin}
        onNew={() => setNewOpen(true)}
        table={
          <DataTable
            data={rows}
            columns={columns}
            exportName="asset-types"
            getRowId={(r) => r.id}
            pageSize={50}
            empty={<EmptyState icon={Shapes} title="No asset types" description="Add types like Laptop (LAP) or Monitor (MON)." />}
          />
        }
      />
      <Modal open={!!active && isAdmin} onOpenChange={(o) => !o && close()} title={active?.id ? "Edit asset type" : "New asset type"}>
        {active && <AssetTypeForm editing={active} locked={active.locked} onDone={close} />}
      </Modal>
    </>
  );
}
