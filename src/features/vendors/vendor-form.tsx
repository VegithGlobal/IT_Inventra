"use client";

import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormGrid } from "@/components/ui/field";
import { VENDOR_CATEGORY, toOptions } from "@/lib/options";
import { createVendor, updateVendor } from "./actions";
import { vendorSchema, type VendorInput } from "./schema";

export const emptyVendor: VendorInput = {
  name: "",
  category: "OTHER",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  website: "",
  notes: "",
};

export function VendorForm({ id, initial = emptyVendor, onDone }: { id?: string; initial?: VendorInput; onDone: (id: string) => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(
    vendorSchema,
    (values) => (id ? updateVendor({ id, data: values }) : createVendor(values)),
    { defaultValues: initial, successMessage: id ? "Vendor updated" : "Vendor added", onSuccess: (r) => onDone(r.id) },
  );
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Name" required className="sm:col-span-2" error={errors.name?.message} {...r("name")} />
        <SelectField label="Category" options={toOptions(VENDOR_CATEGORY)} {...r("category")} />
        <InputField label="GSTIN" placeholder="27AAACB2894G1ZP" error={errors.gstin?.message} {...r("gstin")} />
        <InputField label="Contact person" error={errors.contactPerson?.message} {...r("contactPerson")} />
        <InputField label="Phone" type="tel" error={errors.phone?.message} {...r("phone")} />
        <InputField label="Email" type="email" error={errors.email?.message} {...r("email")} />
        <InputField label="Website" type="url" placeholder="https://" error={errors.website?.message} {...r("website")} />
      </FormGrid>
      <TextareaField label="Address" rows={2} error={errors.address?.message} {...r("address")} />
      <TextareaField label="Notes" error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add vendor"}
        </Button>
      </div>
    </form>
  );
}
