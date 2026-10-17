"use client";

import { Archive, Eye, EyeOff, UserPlus, UserMinus } from "lucide-react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { FormError, InputField, SelectField, TextareaField, useActionForm, useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { FormGrid, FormSection } from "@/components/ui/field";
import { todayInput } from "@/lib/dates";
import { LICENSE_TYPE, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import { archiveLicense, assignSeat, createLicense, revealLicenseKey, revokeSeat, updateLicense } from "./actions";
import type { LicenseLookups } from "./queries";
import { assignSeatSchema, licenseSchema, type LicenseInput } from "./schema";

export const emptyLicense = (): LicenseInput => ({
  name: "",
  vendorId: "",
  type: "PER_USER",
  totalSeats: "1",
  purchaseDate: todayInput(),
  expiryDate: "",
  cost: "",
  subscriptionId: "",
  licenseKey: "",
  clearKey: false,
  notes: "",
  recordExpense: true,
});

/** Seats used / total as a thin bar (site licences show a count only). */
export function SeatBar({ used, total, site }: { used: number; total: number; site?: boolean }) {
  if (site) return <span className="tabular">{used} assigned</span>;
  const pct = Math.min(100, (used / Math.max(1, total)) * 100);
  const full = used >= total;
  return (
    <span className="flex min-w-32 items-center gap-2">
      <span className="h-1.5 flex-1 rounded-full bg-subtle">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("text-[12.5px] tabular", full ? "font-medium text-warning" : "text-fg-secondary")}>
        {used}/{total}
      </span>
    </span>
  );
}

export function LicenseForm({ id, initial, lookups, hasKey, onDone }: { id?: string; initial: LicenseInput; lookups: LicenseLookups; hasKey?: boolean; onDone: (r: { id: string }) => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(licenseSchema, (v) => (id ? updateLicense({ id, data: v }) : createLicense(v)), {
    defaultValues: initial,
    successMessage: id ? "License updated" : "License added",
    onSuccess: onDone,
  });
  const r = form.register;
  const type = useWatch({ control: form.control, name: "type" });
  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <FormSection title="License">
        <FormGrid>
          <InputField label="Name" required className="sm:col-span-2" placeholder="Adobe Acrobat Pro" error={errors.name?.message} {...r("name")} />
          <SelectField label="Type" options={toOptions(LICENSE_TYPE)} {...r("type")} />
          <InputField
            label={type === "SITE" ? "Seats (informational)" : "Total seats"}
            required
            inputMode="numeric"
            error={errors.totalSeats?.message}
            {...r("totalSeats")}
          />
          <SelectField label="Vendor" placeholder="—" options={lookups.vendors} {...r("vendorId")} />
          <SelectField label="Linked subscription" placeholder="—" hint="If it renews as a subscription" options={lookups.subscriptions} {...r("subscriptionId")} />
          <InputField label="Purchase date" type="date" error={errors.purchaseDate?.message} {...r("purchaseDate")} />
          <InputField label="Expiry date" type="date" hint="Blank = perpetual" error={errors.expiryDate?.message} {...r("expiryDate")} />
          <InputField label="Cost (₹)" inputMode="decimal" error={errors.cost?.message} {...r("cost")} />
        </FormGrid>
        {!id && (
          <label className="flex items-center gap-2 text-[13.5px] text-fg">
            <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("recordExpense")} />
            Record the cost as a Software Licenses expense
          </label>
        )}
      </FormSection>
      <FormSection title="Key">
        <TextareaField
          label="License key (stored encrypted)"
          rows={2}
          autoComplete="off"
          spellCheck={false}
          className="[&_textarea]:font-mono"
          placeholder={hasKey ? "•••••••• saved — type to replace" : "XXXXX-XXXXX-XXXXX-XXXXX"}
          error={errors.licenseKey?.message}
          {...r("licenseKey")}
        />
        {hasKey && (
          <label className="flex items-center gap-2 text-[13.5px] text-fg">
            <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("clearKey")} />
            Remove the saved key
          </label>
        )}
        <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      </FormSection>
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add license"}
        </Button>
      </div>
    </form>
  );
}

function AssignSeatForm({ licenseId, type, lookups, onDone }: { licenseId: string; type: keyof typeof LICENSE_TYPE; lookups: LicenseLookups; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(assignSeatSchema, assignSeat, {
    defaultValues: { licenseId, employeeId: "", assetId: "", notes: "" },
    successMessage: "Seat assigned",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        {type !== "PER_DEVICE" && (
          <SelectField label="Employee" required={type === "PER_USER"} placeholder="Choose employee" options={lookups.employees} error={errors.employeeId?.message} className={type === "PER_USER" ? "sm:col-span-2" : ""} {...r("employeeId")} />
        )}
        {type !== "PER_USER" && (
          <SelectField label="Device" required={type === "PER_DEVICE"} placeholder="Choose device" options={lookups.assets} error={errors.assetId?.message} className={type === "PER_DEVICE" ? "sm:col-span-2" : ""} {...r("assetId")} />
        )}
      </FormGrid>
      <InputField label="Note" placeholder="e.g. activation email, machine name" error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Assigning…" : "Assign seat"}
        </Button>
      </div>
    </form>
  );
}

export function LicenseActions({
  id,
  type,
  initial,
  lookups,
  hasKey,
  seatsFull,
}: {
  id: string;
  type: keyof typeof LICENSE_TYPE;
  initial: LicenseInput;
  lookups: LicenseLookups;
  hasKey: boolean;
  seatsFull: boolean;
}) {
  const [assigning, setAssigning] = useState(false);
  return (
    <>
      <ConfirmAction
        action={archiveLicense}
        input={{ id }}
        label="Archive"
        icon={<Archive />}
        variant="ghost"
        title="Archive license?"
        description="All active seats are released and the license is hidden. Seat history and expenses are kept."
        confirmLabel="Archive"
        successMessage="License archived"
        redirectTo="/licenses"
        danger
      />
      <EditSheet title="Edit license">{(close) => <LicenseForm id={id} initial={initial} lookups={lookups} hasKey={hasKey} onDone={close} />}</EditSheet>
      <Button size="sm" variant="primary" disabled={seatsFull} onClick={() => setAssigning(true)} title={seatsFull ? "All seats are in use" : undefined}>
        <UserPlus />
        Assign seat
      </Button>
      <Modal open={assigning} onOpenChange={setAssigning} title="Assign seat" description={LICENSE_TYPE[type]}>
        {assigning && <AssignSeatForm licenseId={id} type={type} lookups={lookups} onDone={() => setAssigning(false)} />}
      </Modal>
    </>
  );
}

export function RevokeSeatButton({ seatId, label }: { seatId: string; label: string }) {
  const { pending, run } = useActionRunner();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeSeat({ seatId }), `Seat freed from ${label}`)}>
      <UserMinus />
      Revoke
    </Button>
  );
}

export function RevealKey({ id }: { id: string }) {
  const [value, setValue] = useState<string | null>(null);
  const { pending, run } = useActionRunner();
  if (value !== null) {
    return (
      <span className="flex items-start gap-2">
        <code className="rounded bg-subtle px-2 py-1 font-mono text-[12.5px] break-all whitespace-pre-wrap text-fg">{value}</code>
        <Button size="icon-sm" variant="ghost" aria-label="Hide key" onClick={() => setValue(null)}>
          <EyeOff />
        </Button>
      </span>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="-ml-3" disabled={pending} onClick={() => run(() => revealLicenseKey({ id }), undefined, (r) => setValue(r.value))}>
      <Eye />
      {pending ? "Decrypting…" : "Reveal key"}
    </Button>
  );
}
