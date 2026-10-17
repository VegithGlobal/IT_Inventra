"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, MoreHorizontal, Pencil, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { DataTable } from "@/components/data-table/data-table";
import { FormError, InputField, SelectField, TextareaField, useActionForm, useActionRunner } from "@/components/forms";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { Modal, SlideOver } from "@/components/ui/dialog";
import { Field, FormGrid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page";
import { formatDateTime } from "@/lib/format";
import { categoryColor } from "@/lib/options";
import { cn, humanize } from "@/lib/utils";
import { createUser, removeLogo, resetPassword, saveCompany, saveExpenseCategory, saveTicketCategory, updateUser, uploadLogo } from "./actions";
import { CHART_KEYS, ROLES, companySchema, expenseCategorySchema, resetPasswordSchema, ticketCategorySchema, userCreateSchema, userUpdateSchema, type CompanyInput } from "./schema";

const ROLE_INFO: Record<(typeof ROLES)[number], string> = {
  ADMIN: "Everything, including settings, users and backups",
  IT_STAFF: "Day-to-day work: assets, tickets, expenses… no settings",
  VIEWER: "Read-only",
};

// ─── Company ──────────────────────────────────────────────────────────────────

export function CompanyView({ initial, hasLogo, isAdmin }: { initial: CompanyInput; hasLogo: boolean; isAdmin: boolean }) {
  const { form, submit, pending, errors, formError } = useActionForm(companySchema, saveCompany, { defaultValues: initial, successMessage: "Company profile saved" });
  const r = form.register;
  const [file, setFile] = useState<File | null>(null);
  const logo = useActionRunner();
  const [logoVersion, setLogoVersion] = useState(0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Company profile" description={isAdmin ? "Shown on handover forms, labels, reports and emails." : "Only admins can change these settings."} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Details" />
          <CardBody>
            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
              <FormError message={formError} />
              <fieldset disabled={!isAdmin} className="contents">
                <FormGrid>
                  <InputField label="Company name" required className="sm:col-span-2" error={errors.name?.message} {...r("name")} />
                  <InputField label="GSTIN" error={errors.gstin?.message} {...r("gstin")} />
                  <InputField label="Default salvage value (%)" hint="Used for new asset types" inputMode="decimal" error={errors.defaultSalvagePercent?.message} {...r("defaultSalvagePercent")} />
                </FormGrid>
                <TextareaField label="Address" rows={2} error={errors.address?.message} {...r("address")} />
              </fieldset>
              <DetailList
                items={[
                  { label: "Currency", value: "INR (₹) — amounts use Indian grouping, ₹1,23,456.00" },
                  { label: "Timezone", value: "Asia/Kolkata (IST) — reminders and due times" },
                  { label: "Date style", value: "15 Oct 2026 on screen · YYYY-MM-DD in CSV exports" },
                ]}
              />
              {isAdmin && (
                <div className="flex justify-end border-t border-line pt-4">
                  <Button type="submit" variant="primary" disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </form>
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Logo" description="PNG, JPG or WEBP. Appears in the sidebar and on printouts." />
          <CardBody className="flex flex-col gap-4">
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-line-strong bg-subtle">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset
                <img src={`/api/branding/logo?v=${logoVersion}`} alt="Company logo" className="max-h-20 max-w-[80%] object-contain" />
              ) : (
                <span className="text-[13px] text-fg-muted">No logo yet</span>
              )}
            </div>
            {isAdmin && (
              <>
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Logo file" />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!file || logo.pending}
                    onClick={() => {
                      const fd = new FormData();
                      if (file) fd.set("file", file);
                      logo.run(() => uploadLogo(fd), "Logo updated", () => setLogoVersion((v) => v + 1));
                    }}
                  >
                    <Upload />
                    Upload
                  </Button>
                  {hasLogo && (
                    <Button size="sm" variant="ghost" disabled={logo.pending} onClick={() => logo.run(() => removeLogo({}), "Logo removed")}>
                      <Trash2 />
                      Remove
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRow = { id: string; name: string; email: string; role: (typeof ROLES)[number]; active: boolean; lastLoginAt: Date | null; createdAt: Date };

function NewUserForm({ onDone }: { onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(userCreateSchema, createUser, {
    defaultValues: { name: "", email: "", role: "IT_STAFF", password: "" },
    successMessage: "Login created",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <InputField label="Name" required error={errors.name?.message} {...r("name")} />
      <InputField label="Email" type="email" required autoComplete="off" error={errors.email?.message} {...r("email")} />
      <SelectField label="Role" options={ROLES.map((x) => ({ value: x, label: `${humanize(x)} — ${ROLE_INFO[x]}` }))} {...r("role")} />
      <InputField label="Temporary password" type="text" required autoComplete="new-password" hint="At least 10 characters with letters and numbers. Share it securely." error={errors.password?.message} {...r("password")} />
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create login"}
        </Button>
      </div>
    </form>
  );
}

function EditUserForm({ user, isSelf, onDone }: { user: UserRow; isSelf: boolean; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(userUpdateSchema, updateUser, {
    defaultValues: { id: user.id, name: user.name, role: user.role, active: user.active },
    successMessage: "User updated",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <InputField label="Name" required error={errors.name?.message} {...r("name")} />
      {isSelf ? (
        <p className="rounded-md bg-subtle px-3 py-2 text-[13px] text-fg-secondary">You can&apos;t change your own role or deactivate yourself.</p>
      ) : (
        <>
          <SelectField label="Role" options={ROLES.map((x) => ({ value: x, label: `${humanize(x)} — ${ROLE_INFO[x]}` }))} {...r("role")} />
          <label className="flex items-center gap-2 text-[13.5px] text-fg">
            <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("active")} />
            Can sign in
          </label>
        </>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(resetPasswordSchema, resetPassword, {
    defaultValues: { id: user.id, password: "" },
    successMessage: `Password reset for ${user.name}`,
    onSuccess: onDone,
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <InputField label="New password" type="text" required autoComplete="new-password" hint="At least 10 characters with letters and numbers." error={errors.password?.message} {...form.register("password")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </Button>
      </div>
    </form>
  );
}

export function UsersView({ rows, meId }: { rows: UserRow[]; meId: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const columns = useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => (
          <span className="flex items-center gap-3">
            <Avatar name={row.original.name} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {row.original.name}
                {row.original.id === meId && <span className="ml-1.5 text-[12px] font-normal text-fg-muted">(you)</span>}
              </span>
              <span className="block truncate text-[12.5px] text-fg-muted">{row.original.email}</span>
            </span>
          </span>
        ),
        meta: { csv: (r) => r.name },
      },
      { accessorKey: "email", header: "Email", meta: { csv: (r) => r.email } },
      { accessorKey: "role", header: "Role", cell: ({ row }) => <Badge tone={row.original.role === "ADMIN" ? "brand" : row.original.role === "IT_STAFF" ? "info" : "neutral"}>{humanize(row.original.role)}</Badge>, meta: { csv: (r) => r.role } },
      { accessorKey: "active", header: "Status", cell: ({ row }) => <Badge tone={row.original.active ? "success" : "neutral"} dot>{row.original.active ? "Active" : "Deactivated"}</Badge>, meta: { csv: (r) => (r.active ? "Active" : "Deactivated") } },
      { accessorKey: "lastLoginAt", header: "Last sign-in", sortingFn: "datetime", cell: ({ row }) => formatDateTime(row.original.lastLoginAt), meta: { csv: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : "") } },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-12" },
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="User actions">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => setEditing(row.original)}>
                  <Pencil /> Edit
                </MenuItem>
                <MenuItem onSelect={() => setResetting(row.original)}>
                  <KeyRound /> Reset password
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        ),
      },
    ],
    [meId],
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users & roles"
        description="App logins for the IT team. Employees who receive assets don't need logins."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <UserPlus />
            New login
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROLES.map((role) => (
          <Card key={role} className="p-4">
            <p className="text-[13.5px] font-medium text-fg">
              {humanize(role)} <span className="text-fg-muted tabular">· {rows.filter((u) => u.role === role && u.active).length}</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">{ROLE_INFO[role]}</p>
          </Card>
        ))}
      </div>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search users…" exportName="users" getRowId={(r) => r.id} onRowClick={setEditing} initialHidden={{ email: false }} />
      <SlideOver open={creating} onOpenChange={setCreating} title="New login">
        {creating && <NewUserForm onDone={() => setCreating(false)} />}
      </SlideOver>
      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Edit ${editing?.name ?? ""}`} size="sm">
        {editing && <EditUserForm user={editing} isSelf={editing.id === meId} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!resetting} onOpenChange={(o) => !o && setResetting(null)} title={`Reset password · ${resetting?.name ?? ""}`} size="sm">
        {resetting && <ResetPasswordForm user={resetting} onDone={() => setResetting(null)} />}
      </Modal>
    </div>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type ExpenseCategoryItem = { id: string; name: string; colorKey: string; isSystem: boolean; used: number };
export type TicketCategoryItem = { id: string; name: string; used: number };

function ExpenseCategoryForm({ initial, onDone }: { initial: ExpenseCategoryItem | null; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(expenseCategorySchema, saveExpenseCategory, {
    defaultValues: { id: initial?.id, name: initial?.name ?? "", colorKey: (CHART_KEYS as readonly string[]).includes(initial?.colorKey ?? "") ? (initial!.colorKey as (typeof CHART_KEYS)[number]) : "chart-7" },
    successMessage: "Category saved",
    onSuccess: onDone,
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <InputField label="Name" required readOnly={initial?.isSystem} hint={initial?.isSystem ? "Built-in — used by auto-created expenses" : undefined} error={errors.name?.message} {...form.register("name")} />
      <Field label="Chart colour">
        <Controller
          control={form.control}
          name="colorKey"
          render={({ field }) => (
            <div className="flex gap-2" role="radiogroup" aria-label="Chart colour">
              {CHART_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={field.value === k}
                  aria-label={k}
                  onClick={() => field.onChange(k)}
                  className={cn("size-7 rounded-full ring-offset-2 ring-offset-surface", field.value === k && "ring-2 ring-fg")}
                  style={{ background: categoryColor(k) }}
                />
              ))}
            </div>
          )}
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function TicketCategoryForm({ initial, onDone }: { initial: TicketCategoryItem | null; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(ticketCategorySchema, saveTicketCategory, {
    defaultValues: { id: initial?.id, name: initial?.name ?? "" },
    successMessage: "Category saved",
    onSuccess: onDone,
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <InputField label="Name" required error={errors.name?.message} {...form.register("name")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function CategoriesView({ expense, ticket, isAdmin }: { expense: ExpenseCategoryItem[]; ticket: TicketCategoryItem[]; isAdmin: boolean }) {
  const [editExpense, setEditExpense] = useState<ExpenseCategoryItem | "new" | null>(null);
  const [editTicket, setEditTicket] = useState<TicketCategoryItem | "new" | null>(null);
  const list = <T extends { id: string; name: string; used: number }>(items: T[], unit: string, onEdit: (i: T) => void, swatch?: (i: T) => string, badge?: (i: T) => boolean) => (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 px-5 py-3">
          {swatch && <span className="size-3 rounded-full" style={{ background: swatch(i) }} aria-hidden />}
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{i.name}</span>
          {badge?.(i) && <Badge>Built-in</Badge>}
          <span className="text-[12.5px] text-fg-muted tabular">
            {i.used} {unit}
          </span>
          {isAdmin && (
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => onEdit(i)}>
              <Pencil />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categories" description="Expense categories (and their chart colours) and ticket categories." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Expense categories" action={isAdmin && <Button size="sm" onClick={() => setEditExpense("new")}><Plus />Add</Button>} />
          {list(expense, "expenses", (i) => setEditExpense(i), (i) => categoryColor(i.colorKey), (i) => i.isSystem)}
        </Card>
        <Card>
          <CardHeader title="Ticket categories" action={isAdmin && <Button size="sm" onClick={() => setEditTicket("new")}><Plus />Add</Button>} />
          {list(ticket, "tickets", (i) => setEditTicket(i))}
        </Card>
      </div>
      <Modal open={!!editExpense} onOpenChange={(o) => !o && setEditExpense(null)} title={editExpense === "new" ? "New expense category" : "Edit expense category"} size="sm">
        {editExpense && <ExpenseCategoryForm initial={editExpense === "new" ? null : editExpense} onDone={() => setEditExpense(null)} />}
      </Modal>
      <Modal open={!!editTicket} onOpenChange={(o) => !o && setEditTicket(null)} title={editTicket === "new" ? "New ticket category" : "Edit ticket category"} size="sm">
        {editTicket && <TicketCategoryForm initial={editTicket === "new" ? null : editTicket} onDone={() => setEditTicket(null)} />}
      </Modal>
    </div>
  );
}
