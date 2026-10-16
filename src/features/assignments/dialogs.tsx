"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/dialog";
import { Field, FormGrid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { todayInput } from "@/lib/dates";
import { ASSET_CONDITION, toOptions } from "@/lib/options";
import { assignAsset, checkInAsset, transferAsset } from "./actions";
import type { AssignOptions } from "./queries";
import { COMMON_ACCESSORIES, assignSchema, checkInSchema, toFormData, transferSchema } from "./schema";

function AccessoriesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const list = value.split(",").map((s) => s.trim()).filter(Boolean);
  const custom = list.filter((a) => !(COMMON_ACCESSORIES as readonly string[]).includes(a)).join(", ");
  const toggle = (item: string, on: boolean) => {
    const next = on ? [...list, item] : list.filter((a) => a !== item);
    onChange(next.join(", "));
  };
  return (
    <Field label="Accessories given">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {COMMON_ACCESSORIES.map((a) => (
          <label key={a} className="flex items-center gap-2 text-[13.5px] text-fg">
            <Checkbox checked={list.includes(a)} onCheckedChange={(v) => toggle(a, !!v)} />
            {a}
          </label>
        ))}
      </div>
      <Input
        placeholder="Other (comma separated)"
        aria-label="Other accessories"
        defaultValue={custom}
        onBlur={(e) => {
          const common = list.filter((a) => (COMMON_ACCESSORIES as readonly string[]).includes(a));
          onChange([...common, ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)].join(", "));
        }}
      />
    </Field>
  );
}

function FileField({ label, onFile }: { label: string; onFile: (f: File | null) => void }) {
  return (
    <Field label={label} hint="Optional · PDF or image, up to 10 MB">
      <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </Field>
  );
}

export function AssignDialog({
  open,
  onOpenChange,
  options,
  assetId,
  employeeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: AssignOptions;
  assetId?: string;
  employeeId?: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Assign asset" description="Check an asset out to an employee." size="lg">
      {open && <AssignForm options={options} assetId={assetId} employeeId={employeeId} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function AssignForm({ options, assetId, employeeId, onDone }: { options: AssignOptions; assetId?: string; employeeId?: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const preset = options.assets.find((a) => a.id === assetId);
  const { form, submit, pending, errors, formError } = useActionForm(assignSchema, (values) => assignAsset(toFormData(values, file)), {
    defaultValues: {
      assetId: assetId ?? "",
      employeeId: employeeId ?? "",
      issuedAt: todayInput(),
      expectedReturnAt: "",
      conditionAtIssue: preset?.condition ?? "GOOD",
      accessories: "",
      notes: "",
    },
    successMessage: "Asset assigned",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <SelectField
          label="Asset"
          required
          placeholder="Choose an available asset"
          options={options.assets.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}${a.status !== "IN_STOCK" ? ` (${a.status.toLowerCase().replace("_", " ")})` : ""}` }))}
          error={errors.assetId?.message}
          {...r("assetId", {
            onChange: (e) => {
              const a = options.assets.find((x) => x.id === e.target.value);
              if (a) form.setValue("conditionAtIssue", a.condition);
            },
          })}
        />
        <SelectField
          label="Employee"
          required
          placeholder="Choose employee"
          options={options.employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` }))}
          error={errors.employeeId?.message}
          {...r("employeeId")}
        />
        <InputField label="Issue date" type="date" required error={errors.issuedAt?.message} {...r("issuedAt")} />
        <InputField label="Expected return" type="date" hint="Optional — for loaners" error={errors.expectedReturnAt?.message} {...r("expectedReturnAt")} />
        <SelectField label="Condition at issue" options={toOptions(ASSET_CONDITION)} {...r("conditionAtIssue")} />
      </FormGrid>
      <Controller control={form.control} name="accessories" render={({ field }) => <AccessoriesField value={field.value} onChange={field.onChange} />} />
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      <FileField label="Signed handover form" onFile={setFile} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </div>
    </form>
  );
}

export function CheckInDialog({
  open,
  onOpenChange,
  assignmentId,
  label,
  defaultCondition,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignmentId: string;
  label: string;
  defaultCondition: "NEW" | "GOOD" | "FAIR" | "POOR";
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Check in asset" description={label}>
      {open && <CheckInForm assignmentId={assignmentId} defaultCondition={defaultCondition} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function CheckInForm({ assignmentId, defaultCondition, onDone }: { assignmentId: string; defaultCondition: "NEW" | "GOOD" | "FAIR" | "POOR"; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const { form, submit, pending, errors, formError } = useActionForm(checkInSchema, (values) => checkInAsset(toFormData(values, file)), {
    defaultValues: { assignmentId, returnedAt: todayInput(), conditionAtReturn: defaultCondition === "NEW" ? "GOOD" : defaultCondition, newStatus: "IN_STOCK", damageNotes: "", returnNotes: "" },
    successMessage: "Asset checked in",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Return date" type="date" required error={errors.returnedAt?.message} {...r("returnedAt")} />
        <SelectField label="Condition at return" options={toOptions(ASSET_CONDITION)} {...r("conditionAtReturn")} />
        <SelectField
          label="Move asset to"
          className="sm:col-span-2"
          options={[
            { value: "IN_STOCK", label: "In stock — ready to reassign" },
            { value: "UNDER_REPAIR", label: "Under repair — needs fixing first" },
          ]}
          {...r("newStatus")}
        />
      </FormGrid>
      <TextareaField label="Damage notes" rows={2} placeholder="Scratches, missing keys, battery health…" error={errors.damageNotes?.message} {...r("damageNotes")} />
      <TextareaField label="Other notes" rows={2} error={errors.returnNotes?.message} {...r("returnNotes")} />
      <FileField label="Signed return form" onFile={setFile} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Checking in…" : "Check in"}
        </Button>
      </div>
    </form>
  );
}

export function TransferDialog({
  open,
  onOpenChange,
  assetId,
  label,
  employees,
  currentEmployeeId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assetId: string;
  label: string;
  employees: AssignOptions["employees"];
  currentEmployeeId: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Transfer asset" description={label}>
      {open && <TransferForm assetId={assetId} employees={employees.filter((e) => e.id !== currentEmployeeId)} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function TransferForm({ assetId, employees, onDone }: { assetId: string; employees: AssignOptions["employees"]; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(transferSchema, transferAsset, {
    defaultValues: { assetId, toEmployeeId: "", date: todayInput(), condition: "GOOD", accessories: "", notes: "" },
    successMessage: "Asset transferred",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <p className="text-[13px] text-fg-muted">Recorded as a check-in from the current holder and a check-out to the new one, so both appear in the history.</p>
      <FormGrid>
        <SelectField
          label="Transfer to"
          required
          placeholder="Choose employee"
          className="sm:col-span-2"
          options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` }))}
          error={errors.toEmployeeId?.message}
          {...r("toEmployeeId")}
        />
        <InputField label="Transfer date" type="date" required error={errors.date?.message} {...r("date")} />
        <SelectField label="Condition" options={toOptions(ASSET_CONDITION)} {...r("condition")} />
      </FormGrid>
      <Controller control={form.control} name="accessories" render={({ field }) => <AccessoriesField value={field.value} onChange={field.onChange} />} />
      <TextareaField label="Notes" rows={2} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Transferring…" : "Transfer"}
        </Button>
      </div>
    </form>
  );
}
