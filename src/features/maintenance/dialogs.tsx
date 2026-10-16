"use client";

import { Wrench } from "lucide-react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { FormGrid } from "@/components/ui/field";
import { todayInput } from "@/lib/dates";
import { ASSET_CONDITION, toOptions } from "@/lib/options";
import { closeMaintenance, openMaintenance, updateMaintenance } from "./actions";
import type { MaintenanceLookups } from "./queries";
import { closeMaintenanceSchema, maintenanceSchema, type MaintenanceInput } from "./schema";

export const emptyRepair = (preset: Partial<MaintenanceInput> = {}): MaintenanceInput => ({
  assetId: "",
  issue: "",
  sentAt: todayInput(),
  vendorId: "",
  expectedReturnAt: "",
  underWarranty: false,
  cost: "",
  ticketId: "",
  notes: "",
  ...preset,
});

export function RepairForm({ id, initial, lookups, lockAsset, onDone }: { id?: string; initial: MaintenanceInput; lookups: MaintenanceLookups; lockAsset?: boolean; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(maintenanceSchema, (data) => (id ? updateMaintenance({ id, data }) : openMaintenance(data)), {
    defaultValues: initial,
    successMessage: id ? "Repair updated" : "Repair logged · asset marked Under repair",
    onSuccess: onDone,
  });
  const r = form.register;
  const assetId = useWatch({ control: form.control, name: "assetId" });
  const inWarranty = lookups.assets.find((a) => a.value === assetId)?.inWarranty;
  const assetLabel = lookups.assets.find((a) => a.value === initial.assetId)?.label ?? "";
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        {lockAsset || id ? (
          <InputField label="Asset" name="assetLabel" readOnly value={assetLabel} className="sm:col-span-2" />
        ) : (
          <SelectField
            label="Asset"
            required
            className="sm:col-span-2"
            placeholder="Choose asset"
            options={lookups.assets}
            error={errors.assetId?.message}
            {...r("assetId", { onChange: (e) => form.setValue("underWarranty", !!lookups.assets.find((a) => a.value === e.target.value)?.inWarranty) })}
          />
        )}
        <InputField label="Issue" required className="sm:col-span-2" placeholder="Screen flickering, hinge cracked" error={errors.issue?.message} {...r("issue")} />
        <SelectField label="Service centre / vendor" placeholder="—" options={lookups.vendors} {...r("vendorId")} />
        <SelectField label="Related ticket" placeholder="—" options={lookups.tickets} {...r("ticketId")} />
        <InputField label="Date sent" type="date" required error={errors.sentAt?.message} {...r("sentAt")} />
        <InputField label="Expected back" type="date" error={errors.expectedReturnAt?.message} {...r("expectedReturnAt")} />
        <InputField label="Cost (₹)" inputMode="decimal" hint="Estimate now or final cost on return — creates the expense" error={errors.cost?.message} {...r("cost")} />
      </FormGrid>
      <label className="flex items-center gap-2 text-[13.5px] text-fg">
        <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("underWarranty")} />
        Under warranty {inWarranty !== undefined && <span className="text-fg-muted">({inWarranty ? "warranty active" : "warranty expired"})</span>}
      </label>
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Send for repair"}
        </Button>
      </div>
    </form>
  );
}

/** Button + modal to log a repair, optionally preset to an asset/ticket. */
export function SendToRepairButton({
  lookups,
  preset,
  label = "Send for repair",
  variant = "secondary",
}: {
  lookups: MaintenanceLookups;
  preset?: Partial<MaintenanceInput>;
  label?: string;
  variant?: ButtonProps["variant"];
}) {
  const [open, setOpen] = useState(false);
  const inWarranty = !!lookups.assets.find((a) => a.value === preset?.assetId)?.inWarranty;
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Wrench />
        {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Send for repair" description="The asset is marked Under repair until you close the repair." size="lg">
        {open && <RepairForm initial={emptyRepair({ underWarranty: inWarranty, ...preset })} lookups={lookups} lockAsset={!!preset?.assetId} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

export function CloseRepairDialog({
  target,
  onOpenChange,
}: {
  target: { id: string; label: string; cost: number | null; previousLabel: string } | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Modal open={!!target} onOpenChange={onOpenChange} title="Back from repair" description={target?.label}>
      {target && <CloseForm target={target} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function CloseForm({ target, onDone }: { target: { id: string; cost: number | null; previousLabel: string }; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(closeMaintenanceSchema, closeMaintenance, {
    defaultValues: { id: target.id, returnedAt: todayInput(), outcome: "", cost: target.cost === null ? "" : target.cost.toFixed(2), condition: "GOOD", assetStatus: "PREVIOUS" },
    successMessage: "Repair closed",
    onSuccess: onDone,
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Returned on" type="date" required error={errors.returnedAt?.message} {...r("returnedAt")} />
        <InputField label="Final cost (₹)" inputMode="decimal" hint="Blank or 0 = no charge" error={errors.cost?.message} {...r("cost")} />
        <SelectField label="Condition now" options={toOptions(ASSET_CONDITION)} {...r("condition")} />
        <SelectField
          label="Asset goes to"
          options={[
            { value: "PREVIOUS", label: `Back to ${target.previousLabel}` },
            { value: "IN_STOCK", label: "In stock" },
            { value: "RETIRED", label: "Retired (not worth fixing)" },
            { value: "DISPOSED", label: "Disposed" },
          ]}
          {...r("assetStatus")}
        />
      </FormGrid>
      <TextareaField label="Outcome" required rows={3} placeholder="Display panel replaced under warranty" error={errors.outcome?.message} {...r("outcome")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Close repair"}
        </Button>
      </div>
    </form>
  );
}
