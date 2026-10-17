"use client";

import { Archive, Eye, EyeOff, Plus, RotateCcw, ShieldOff, UserX } from "lucide-react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { FormError, InputField, SelectField, TextareaField, useActionForm, useActionRunner } from "@/components/forms";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal, SlideOver } from "@/components/ui/dialog";
import { FormGrid, FormSection } from "@/components/ui/field";
import { todayInput } from "@/lib/dates";
import { ACCOUNT_STATUS, SYSTEM_CATEGORY, toOptions } from "@/lib/options";
import { archiveAccount, archiveSystem, closeAccounts, createAccount, createSystem, reopenAccount, revealAccountPassword, updateAccount, updateSystem } from "./actions";
import type { AccountLookups } from "./queries";
import { accountSchema, CLOSED_STATUSES, closeAccountsSchema, systemSchema, type AccountInput, type SystemInput } from "./schema";

const CLOSE_OPTIONS = CLOSED_STATUSES.map((s) => ({ value: s, label: ACCOUNT_STATUS[s].label }));

export const emptySystem = (name = ""): SystemInput => ({ name, category: "SOFTWARE", loginUrl: "", vendorId: "", offboardingSteps: "", notes: "" });

export const emptyAccount = (preset: Partial<AccountInput> = {}): AccountInput => ({
  employeeId: "",
  systemId: "",
  username: "",
  accessLevel: "",
  mfaEnabled: false,
  personal: false,
  grantedAt: todayInput(),
  password: "",
  clearPassword: false,
  notes: "",
  ...preset,
});

const Check = ({ label, ...props }: { label: string } & React.ComponentProps<"input">) => (
  <label className="flex items-start gap-2 text-[13.5px] text-fg">
    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--action)]" {...props} />
    {label}
  </label>
);

// ─── Systems ─────────────────────────────────────────────────────────────────

export function SystemForm({ id, initial, vendors, onDone }: { id?: string; initial: SystemInput; vendors: AccountLookups["vendors"]; onDone: (r: { id: string; name?: string }) => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(systemSchema, (v) => (id ? updateSystem({ id, data: v }) : createSystem(v)), {
    defaultValues: initial,
    successMessage: id ? "System updated" : "System added",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Name" required className="sm:col-span-2" placeholder="Google Workspace, Tally Prime, AWS…" error={errors.name?.message} {...r("name")} />
        <SelectField label="Category" options={toOptions(SYSTEM_CATEGORY)} {...r("category")} />
        <SelectField label="Vendor" placeholder="—" options={vendors} {...r("vendorId")} />
        <InputField label="Login / admin URL" className="sm:col-span-2" placeholder="https://admin.google.com" error={errors.loginUrl?.message} {...r("loginUrl")} />
      </FormGrid>
      <TextareaField
        label="How to block someone here"
        hint="Shown on every leaver's checklist"
        rows={3}
        placeholder="Admin console → Users → select user → Suspend. Transfer Drive files to the manager first."
        error={errors.offboardingSteps?.message}
        {...r("offboardingSteps")}
      />
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add system"}
        </Button>
      </div>
    </form>
  );
}

export function SystemActions({ id, initial, lookups, hasActive }: { id: string; initial: SystemInput; lookups: AccountLookups; hasActive: boolean }) {
  return (
    <>
      {!hasActive && (
        <ConfirmAction
          action={archiveSystem}
          input={{ id }}
          label="Archive"
          icon={<Archive />}
          variant="ghost"
          title="Archive system?"
          description="It's hidden from pickers. Closed account history is kept."
          confirmLabel="Archive"
          successMessage="System archived"
          redirectTo="/accounts/systems"
          danger
        />
      )}
      <EditSheet title="Edit system">{(close) => <SystemForm id={id} initial={initial} vendors={lookups.vendors} onDone={close} />}</EditSheet>
      <AddAccountButton lookups={lookups} preset={{ systemId: id }} />
    </>
  );
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export function AccountForm({
  id,
  initial,
  lookups,
  hasPassword,
  onDone,
}: {
  id?: string;
  initial: AccountInput;
  lookups: AccountLookups;
  hasPassword?: boolean;
  onDone: (r: { id: string }) => void;
}) {
  const { form, submit, pending, errors, formError } = useActionForm(accountSchema, (v) => (id ? updateAccount({ id, data: v }) : createAccount(v)), {
    defaultValues: initial,
    successMessage: id ? "Account updated" : "Login recorded",
    onSuccess: onDone,
  });
  const r = form.register;
  const [newSystem, setNewSystem] = useState(false);
  const [added, setAdded] = useState<{ value: string; label: string }[]>([]);
  const systems = [...lookups.systems, ...added.filter((a) => !lookups.systems.some((s) => s.value === a.value))];
  const personal = useWatch({ control: form.control, name: "personal" });
  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <FormError message={formError} />
        <FormSection title="Who and where">
          <FormGrid>
            <SelectField label="Employee" required className="sm:col-span-2" placeholder="Choose employee" options={lookups.employees} error={errors.employeeId?.message} {...r("employeeId")} />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <SelectField label="System" required placeholder="Choose system" options={systems} error={errors.systemId?.message} {...r("systemId")} />
              <button type="button" className="self-start text-[12.5px] font-medium text-fg-secondary hover:text-fg hover:underline" onClick={() => setNewSystem(true)}>
                + Add a system that isn&apos;t listed
              </button>
            </div>
            <InputField
              label="Login ID / username"
              required
              className="sm:col-span-2"
              placeholder="ravi.k@company.in, ravi_k, 1002…"
              autoComplete="off"
              spellCheck={false}
              error={errors.username?.message}
              {...r("username")}
            />
            <InputField label="Access level" placeholder="Admin, User, Read-only…" error={errors.accessLevel?.message} {...r("accessLevel")} />
            <InputField label="Given on" type="date" error={errors.grantedAt?.message} {...r("grantedAt")} />
          </FormGrid>
          <Check label="Two-factor (2FA / OTP) is on" {...r("mfaEnabled")} />
          <Check label="Employee's own account used for work (e.g. personal Gmail) — remove its access on exit, don't delete it" {...r("personal")} />
        </FormSection>
        <FormSection title="Password">
          <InputField
            label="Password (stored encrypted)"
            type="password"
            autoComplete="new-password"
            hint={personal ? "Usually leave blank for personal accounts" : "Optional. Or keep only a note below on where it's stored."}
            placeholder={hasPassword ? "•••••••• saved — type to replace" : ""}
            error={errors.password?.message}
            {...r("password")}
          />
          {hasPassword && <Check label="Remove the saved password" {...r("clearPassword")} />}
          <TextareaField label="Notes" rows={2} placeholder="e.g. password in the IT vault, recovery phone +91…" error={errors.notes?.message} {...r("notes")} />
        </FormSection>
        <div className="flex justify-end border-t border-line pt-4">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : id ? "Save changes" : "Save login"}
          </Button>
        </div>
      </form>
      {/* Outside the <form>: React events bubble through portals, so a nested submit would reach it. */}
      <Modal open={newSystem} onOpenChange={setNewSystem} title="New system" size="lg">
        {newSystem && (
          <SystemForm
            initial={emptySystem()}
            vendors={lookups.vendors}
            onDone={(s) => {
              setNewSystem(false);
              // Show it in the picker right away (the server list catches up on refresh), then select it.
              setAdded((list) => [...list, { value: s.id, label: s.name ?? "New system" }]);
              setTimeout(() => form.setValue("systemId", s.id, { shouldValidate: true }), 0);
            }}
          />
        )}
      </Modal>
    </>
  );
}

export function AddAccountButton({ lookups, preset, label = "Add login", variant = "primary" }: { lookups: AccountLookups; preset?: Partial<AccountInput>; label?: string; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus />
        {label}
      </Button>
      <SlideOver open={open} onOpenChange={setOpen} title="Record a login">
        {open && <AccountForm initial={emptyAccount(preset)} lookups={lookups} onDone={() => setOpen(false)} />}
      </SlideOver>
    </>
  );
}

function CloseForm({ ids, onDone, onCancel }: { ids: string[]; onDone: () => void; onCancel: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(closeAccountsSchema, closeAccounts, {
    defaultValues: { ids, status: "DISABLED", note: "" },
    successMessage: ids.length === 1 ? "Access closed" : `${ids.length} accounts closed`,
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <SelectField label="What did you do?" options={CLOSE_OPTIONS} {...r("status")} />
      <InputField label="Note" placeholder="e.g. mailbox forwarded to manager, Drive transferred" error={errors.note?.message} {...r("note")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : ids.length === 1 ? "Mark as closed" : `Close ${ids.length} accounts`}
        </Button>
      </div>
    </form>
  );
}

/** Opens a small dialog to record how access was cut (disabled / deleted / handed over) with a note. */
export function CloseAccountsButton({ ids, label, size = "sm", variant = "secondary", onDone }: { ids: string[]; label: string; size?: ButtonProps["size"]; variant?: ButtonProps["variant"]; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} disabled={!ids.length}>
        <UserX />
        {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={ids.length === 1 ? "Close this login" : `Close ${ids.length} logins`} description="Do this after you've blocked access in the system itself." size="sm">
        {open && (
          <CloseForm
            ids={ids}
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false);
              onDone?.();
            }}
          />
        )}
      </Modal>
    </>
  );
}

/** One-click "I've disabled it" for the offboarding banner. */
export function QuickDisableButton({ id, label }: { id: string; label: string }) {
  const { pending, run } = useActionRunner();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(() => closeAccounts({ ids: [id], status: "DISABLED", note: "" }), `${label} marked disabled`)}>
      <ShieldOff />
      {pending ? "Saving…" : "Mark disabled"}
    </Button>
  );
}

export function ReopenAccountButton({ id }: { id: string }) {
  const { pending, run } = useActionRunner();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(() => reopenAccount({ id }), "Account marked active again")}>
      <RotateCcw />
      Reactivate
    </Button>
  );
}

export function AccountActions({ id, initial, lookups, hasPassword, active }: { id: string; initial: AccountInput; lookups: AccountLookups; hasPassword: boolean; active: boolean }) {
  return (
    <>
      <ConfirmAction
        action={archiveAccount}
        input={{ id }}
        label="Delete record"
        icon={<Archive />}
        variant="ghost"
        title="Delete this record?"
        description="Only for logins entered by mistake. When someone leaves, use “Close access” instead so the history shows what was blocked and by whom."
        confirmLabel="Delete record"
        successMessage="Record deleted"
        redirectTo="/accounts"
        danger
      />
      <EditSheet title="Edit login">{(close) => <AccountForm id={id} initial={initial} lookups={lookups} hasPassword={hasPassword} onDone={close} />}</EditSheet>
      {active ? <CloseAccountsButton ids={[id]} label="Close access" variant="primary" /> : <ReopenAccountButton id={id} />}
    </>
  );
}

export function RevealPassword({ id }: { id: string }) {
  const [value, setValue] = useState<string | null>(null);
  const { pending, run } = useActionRunner();
  if (value !== null) {
    return (
      <span className="flex items-start gap-2">
        <code className="rounded bg-subtle px-2 py-1 font-mono text-[12.5px] break-all whitespace-pre-wrap text-fg">{value}</code>
        <Button size="icon-sm" variant="ghost" aria-label="Hide password" onClick={() => setValue(null)}>
          <EyeOff />
        </Button>
      </span>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="-ml-3" disabled={pending} onClick={() => run(() => revealAccountPassword({ id }), undefined, (r) => setValue(r.value))}>
      <Eye />
      {pending ? "Decrypting…" : "Reveal password"}
    </Button>
  );
}
