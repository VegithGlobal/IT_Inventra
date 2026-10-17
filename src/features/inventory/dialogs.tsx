"use client";

import { useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { FormGrid } from "@/components/ui/field";
import { todayInput } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { adjustStock, createItem, stockIn, stockOut, updateItem } from "./actions";
import type { InventoryLookups } from "./queries";
import { adjustSchema, itemCreateSchema, itemSchema, stockInSchema, stockOutSchema, type ItemCreateInput, type ItemInput } from "./schema";

export const emptyItem = (): ItemCreateInput => ({
  name: "",
  category: "",
  sku: "",
  unit: "pcs",
  minQuantity: "2",
  unitCost: "",
  locationId: "",
  vendorId: "",
  notes: "",
  openingQuantity: "0",
});

function ItemFields({ lookups, errors, register, withOpening }: {
  lookups: InventoryLookups;
  // react-hook-form register/errors for either schema; field names are shared.
  register: (name: keyof ItemCreateInput) => UseFormRegisterReturn;
  errors: Partial<Record<keyof ItemCreateInput, { message?: string }>>;
  withOpening: boolean;
}) {
  return (
    <>
      <FormGrid>
        <InputField label="Name" required className="sm:col-span-2" placeholder="Logitech M90 USB Mouse" error={errors.name?.message} {...register("name")} />
        <InputField label="Category" required list="inventory-categories" placeholder="Mouse, Cable, Toner…" error={errors.category?.message} {...register("category")} />
        <InputField label="SKU" required placeholder="ACC-MOU-M90" className="[&_input]:uppercase" error={errors.sku?.message} {...register("sku")} />
        <InputField label="Unit" required placeholder="pcs, box, m" error={errors.unit?.message} {...register("unit")} />
        <InputField label="Reorder point" required inputMode="numeric" hint="Alert when stock falls to this" error={errors.minQuantity?.message} {...register("minQuantity")} />
        {withOpening && <InputField label="Opening stock" inputMode="numeric" error={errors.openingQuantity?.message} {...register("openingQuantity")} />}
        <InputField label="Unit cost (₹)" inputMode="decimal" error={errors.unitCost?.message} {...register("unitCost")} />
        <SelectField label="Location" placeholder="—" options={lookups.locations} {...register("locationId")} />
        <SelectField label="Usual vendor" placeholder="—" options={lookups.vendors} {...register("vendorId")} />
      </FormGrid>
      <datalist id="inventory-categories">
        {lookups.categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />
    </>
  );
}

export function NewItemForm({ lookups, onDone }: { lookups: InventoryLookups; onDone: (r: { id: string }) => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(itemCreateSchema, createItem, { defaultValues: emptyItem(), successMessage: "Item added", onSuccess: onDone });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <ItemFields lookups={lookups} errors={errors} register={(n) => form.register(n)} withOpening />
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Add item"}
        </Button>
      </div>
    </form>
  );
}

export function EditItemForm({ id, initial, lookups, onDone }: { id: string; initial: ItemInput; lookups: InventoryLookups; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(itemSchema, (data) => updateItem({ id, data }), { defaultValues: initial, successMessage: "Item updated", onSuccess: onDone });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <ItemFields lookups={lookups} errors={errors} register={(n) => form.register(n as keyof ItemInput)} withOpening={false} />
      <p className="text-[12.5px] text-fg-muted">Quantity changes go through Stock in, Issue or Adjust so every change is logged.</p>
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export type StockTarget = { id: string; name: string; unit: string; quantity: number; unitCost: number | null; vendorId?: string | null };
export type StockMode = "in" | "out" | "adjust";

const TITLES: Record<StockMode, string> = { in: "Stock in", out: "Issue stock", adjust: "Adjust count" };

export function StockDialog({
  target,
  mode,
  lookups,
  preset,
  onOpenChange,
}: {
  target: StockTarget | null;
  mode: StockMode;
  lookups: InventoryLookups;
  preset?: { ticketId?: string; employeeId?: string };
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Modal open={!!target} onOpenChange={onOpenChange} title={TITLES[mode]} description={target ? `${target.name} · ${target.quantity} ${target.unit} on hand` : undefined}>
      {target && mode === "in" && <StockInForm t={target} lookups={lookups} onDone={() => onOpenChange(false)} />}
      {target && mode === "out" && <StockOutForm t={target} lookups={lookups} preset={preset} onDone={() => onOpenChange(false)} />}
      {target && mode === "adjust" && <AdjustForm t={target} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function Footer({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-line pt-4">
      <Button onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </div>
  );
}

function StockInForm({ t, lookups, onDone }: { t: StockTarget; lookups: InventoryLookups; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(stockInSchema, stockIn, {
    defaultValues: {
      itemId: t.id,
      quantity: "",
      unitCost: t.unitCost === null ? "" : t.unitCost.toFixed(2),
      vendorId: t.vendorId ?? "",
      invoiceNumber: "",
      date: todayInput(),
      recordExpense: true,
      notes: "",
    },
    successMessage: "Stock added",
    onSuccess: onDone,
  });
  const r = form.register;
  const [qty, cost, record] = useWatch({ control: form.control, name: ["quantity", "unitCost", "recordExpense"] });
  const total = Number(qty) * Number(cost);
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label={`Quantity (${t.unit})`} required inputMode="numeric" autoFocus error={errors.quantity?.message} {...r("quantity")} />
        <InputField label="Unit cost (₹)" inputMode="decimal" error={errors.unitCost?.message} {...r("unitCost")} />
        <SelectField label="Vendor" placeholder="—" options={lookups.vendors} {...r("vendorId")} />
        <InputField label="Invoice number" error={errors.invoiceNumber?.message} {...r("invoiceNumber")} />
        <InputField label="Date" type="date" required error={errors.date?.message} {...r("date")} />
      </FormGrid>
      <label className="flex items-center gap-2 text-[13.5px] text-fg">
        <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("recordExpense")} />
        Record as a Consumables expense{record && total > 0 ? ` · ${formatMoney(total)}` : ""}
      </label>
      <TextareaField label="Notes" rows={2} {...r("notes")} />
      <Footer pending={pending} label="Add stock" onCancel={onDone} />
    </form>
  );
}

function StockOutForm({ t, lookups, preset, onDone }: { t: StockTarget; lookups: InventoryLookups; preset?: { ticketId?: string; employeeId?: string }; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(stockOutSchema, stockOut, {
    defaultValues: { itemId: t.id, quantity: "1", employeeId: preset?.employeeId ?? "", ticketId: preset?.ticketId ?? "", date: todayInput(), notes: "" },
    successMessage: "Stock issued",
    onSuccess: (r) => {
      onDone();
      if (r.low) toast.warning(`${t.name} is now at or below its reorder point (${r.quantity} left)`);
    },
  });
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label={`Quantity (${t.unit})`} required inputMode="numeric" autoFocus hint={`${t.quantity} available`} error={errors.quantity?.message} {...r("quantity")} />
        <InputField label="Date" type="date" required error={errors.date?.message} {...r("date")} />
        <SelectField
          label="Given to"
          placeholder="—"
          options={lookups.employees}
          {...r("employeeId")}
        />
        <SelectField
          label="Used on ticket"
          placeholder="—"
          options={lookups.tickets}
          {...r("ticketId", {
            onChange: (e) => {
              const tk = lookups.tickets.find((x) => x.value === e.target.value);
              if (tk && !form.getValues("employeeId")) form.setValue("employeeId", tk.requesterId);
            },
          })}
        />
      </FormGrid>
      <TextareaField label="Notes" rows={2} placeholder="e.g. replacement for broken mouse" error={errors.notes?.message} {...r("notes")} />
      <Footer pending={pending} label="Issue" onCancel={onDone} />
    </form>
  );
}

function AdjustForm({ t, onDone }: { t: StockTarget; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(adjustSchema, adjustStock, {
    defaultValues: { itemId: t.id, newQuantity: String(t.quantity), reason: "" },
    successMessage: "Stock adjusted",
    onSuccess: onDone,
  });
  const r = form.register;
  const counted = useWatch({ control: form.control, name: "newQuantity" });
  const diff = Number(counted) - t.quantity;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <InputField
        label={`Counted quantity (${t.unit})`}
        required
        inputMode="numeric"
        autoFocus
        hint={Number.isFinite(diff) && diff !== 0 ? `${diff > 0 ? "+" : ""}${diff} vs system (${t.quantity})` : `System says ${t.quantity}`}
        error={errors.newQuantity?.message}
        {...r("newQuantity")}
      />
      <TextareaField label="Reason" required rows={2} placeholder="Stock-take, damaged units written off…" error={errors.reason?.message} {...r("reason")} />
      <Footer pending={pending} label="Save count" onCancel={onDone} />
    </form>
  );
}
