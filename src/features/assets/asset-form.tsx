"use client";

import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormGrid, FormSection } from "@/components/ui/field";
import { todayInput } from "@/lib/dates";
import { ASSET_CONDITION, ASSET_STATUS, toOptions } from "@/lib/options";
import type { Lookups } from "@/features/employees/queries";
import { createAsset, updateAsset } from "./actions";
import { MANUAL_STATUSES, assetSchema, type AssetInput } from "./schema";

export const emptyAsset = (): AssetInput => ({
  name: "",
  typeId: "",
  brand: "",
  model: "",
  serialNumber: "",
  cpu: "",
  ram: "",
  storage: "",
  os: "",
  purchaseDate: todayInput(),
  purchaseCost: "",
  vendorId: "",
  invoiceNumber: "",
  warrantyStart: "",
  warrantyEnd: "",
  locationId: "",
  departmentId: "",
  condition: "NEW",
  status: "IN_STOCK",
  notes: "",
  recordExpense: true,
});

export function AssetForm({
  id,
  initial,
  lookups,
  onDone,
}: {
  id?: string;
  initial?: AssetInput;
  lookups: Lookups;
  onDone: (result: { id: string }) => void;
}) {
  const { form, submit, pending, errors, formError } = useActionForm(
    assetSchema,
    (values) => (id ? updateAsset({ id, data: values }) : createAsset(values)),
    { defaultValues: initial ?? emptyAsset(), successMessage: id ? "Asset updated" : "Asset created", onSuccess: onDone },
  );
  const r = form.register;
  const opts = (list: { id: string; name: string }[]) => list.map((x) => ({ value: x.id, label: x.name }));
  const assigned = initial?.status === "ASSIGNED";
  const statusOptions = MANUAL_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS[s].label }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <FormSection title="Basics">
        <FormGrid>
          <InputField label="Name" required className="sm:col-span-2" placeholder='Dell Latitude 5440' error={errors.name?.message} {...r("name")} />
          {id ? (
            // Disabled inputs drop out of the submitted values, so show read-only text instead.
            <InputField label="Type" name="typeLabel" readOnly value={lookups.assetTypes.find((t) => t.id === initial?.typeId)?.name ?? ""} hint="Fixed once the tag is issued" />
          ) : (
            <SelectField
              label="Type"
              required
              placeholder="Choose type"
              hint="Sets the tag prefix"
              options={lookups.assetTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.prefix})` }))}
              error={errors.typeId?.message}
              {...r("typeId")}
            />
          )}
          <InputField label="Serial number" error={errors.serialNumber?.message} {...r("serialNumber")} />
          <InputField label="Brand" error={errors.brand?.message} {...r("brand")} />
          <InputField label="Model" error={errors.model?.message} {...r("model")} />
          {assigned ? (
            <InputField label="Status" name="statusLabel" readOnly value="Assigned" hint="Check the asset in to change its status" />
          ) : (
            <SelectField label="Status" options={statusOptions} error={errors.status?.message} {...r("status")} />
          )}
          <SelectField label="Condition" options={toOptions(ASSET_CONDITION)} {...r("condition")} />
        </FormGrid>
      </FormSection>

      <FormSection title="Specs">
        <FormGrid>
          <InputField label="CPU" placeholder="Intel Core i7-1355U" {...r("cpu")} />
          <InputField label="RAM" placeholder="16 GB" {...r("ram")} />
          <InputField label="Storage" placeholder="512 GB SSD" {...r("storage")} />
          <InputField label="OS" placeholder="Windows 11 Pro" {...r("os")} />
        </FormGrid>
      </FormSection>

      <FormSection title="Purchase & warranty">
        <FormGrid>
          <InputField label="Purchase date" type="date" error={errors.purchaseDate?.message} {...r("purchaseDate")} />
          <InputField label="Purchase cost (₹)" inputMode="decimal" placeholder="78500.00" error={errors.purchaseCost?.message} {...r("purchaseCost")} />
          <SelectField label="Vendor" placeholder="—" options={opts(lookups.vendors)} {...r("vendorId")} />
          <InputField label="Invoice number" error={errors.invoiceNumber?.message} {...r("invoiceNumber")} />
          <InputField label="Warranty start" type="date" error={errors.warrantyStart?.message} {...r("warrantyStart")} />
          <InputField label="Warranty end" type="date" error={errors.warrantyEnd?.message} {...r("warrantyEnd")} />
        </FormGrid>
        {!id && (
          <label className="flex items-center gap-2 text-[13.5px] text-fg">
            <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("recordExpense")} />
            Record the purchase as a Hardware expense
          </label>
        )}
      </FormSection>

      <FormSection title="Where">
        <FormGrid>
          <SelectField label="Location" placeholder="—" options={opts(lookups.locations)} {...r("locationId")} />
          <SelectField label="Department" placeholder="—" options={opts(lookups.departments)} {...r("departmentId")} />
        </FormGrid>
        <TextareaField label="Notes" error={errors.notes?.message} {...r("notes")} />
      </FormSection>

      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}
