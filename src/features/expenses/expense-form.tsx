"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import { FormError, InputField, SelectField, TextareaField, useActionForm, type Option } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { todayInput } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PAYMENT_MODE, toOptions } from "@/lib/options";
import { createExpense, updateExpense } from "./actions";
import type { ExpenseCategoryRow, ExpenseLinkOptions } from "./queries";
import { expenseSchema, type ExpenseInput } from "./schema";

export const emptyExpense = (): ExpenseInput => ({
  date: todayInput(),
  categoryId: "",
  description: "",
  amount: "",
  taxAmount: "",
  vendorId: "",
  paymentMode: "UPI",
  transactionRef: "",
  paidBy: "",
  notes: "",
  linkType: "",
  linkId: "",
});

const LINK_LABEL = { asset: "Asset", subscription: "Subscription", ticket: "Ticket", inventoryItem: "Stock item" } as const;

export function ExpenseForm({
  id,
  initial,
  categories,
  vendors,
  linkOptions,
  lockedMoney,
  onDone,
}: {
  id?: string;
  initial?: ExpenseInput;
  categories: ExpenseCategoryRow[];
  vendors: Option[];
  linkOptions: ExpenseLinkOptions;
  /** Subscription-payment expenses: amount and date belong to the payment. */
  lockedMoney?: boolean;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const { form, submit, pending, errors, formError } = useActionForm(
    expenseSchema,
    (values) => {
      if (id) return updateExpense({ id, data: values });
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) fd.set(k, v);
      if (file) {
        fd.set("file", file);
        fd.set("invoiceNumber", invoiceNumber);
      }
      return createExpense(fd);
    },
    { defaultValues: initial ?? emptyExpense(), successMessage: id ? "Expense updated" : "Expense added", onSuccess: onDone },
  );
  const r = form.register;
  const [linkType, amount, tax] = useWatch({ control: form.control, name: ["linkType", "amount", "taxAmount"] });
  const base = Number(amount) - (Number(tax) || 0);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      {lockedMoney && (
        <p className="rounded-md bg-info-soft px-3 py-2 text-[13px] text-info">
          Created by a subscription payment. Amount and date are locked — void the payment on the subscription to change them.
        </p>
      )}
      <FormGrid>
        <InputField label="Description" required className="sm:col-span-2" placeholder="HP 26A toner cartridges × 3" error={errors.description?.message} {...r("description")} />
        <InputField label="Date" type="date" required readOnly={lockedMoney} error={errors.date?.message} {...r("date")} />
        <SelectField
          label="Category"
          required
          placeholder="Choose category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          error={errors.categoryId?.message}
          {...r("categoryId")}
        />
        <InputField
          label="Total paid (₹)"
          required
          inputMode="decimal"
          readOnly={lockedMoney}
          hint="Including GST"
          error={errors.amount?.message}
          {...r("amount")}
        />
        <InputField
          label="GST included (₹)"
          inputMode="decimal"
          readOnly={lockedMoney}
          hint={Number(tax) > 0 && base >= 0 ? `Base amount ${formatMoney(base)}` : "Optional"}
          error={errors.taxAmount?.message}
          {...r("taxAmount")}
        />
        <SelectField label="Vendor" placeholder="—" options={vendors} {...r("vendorId")} />
        <SelectField label="Payment mode" placeholder="—" options={toOptions(PAYMENT_MODE)} {...r("paymentMode")} />
        <InputField label="Transaction reference" error={errors.transactionRef?.message} {...r("transactionRef")} />
        <InputField label="Paid by" placeholder="Admin / Accounts / card holder" error={errors.paidBy?.message} {...r("paidBy")} />
        <SelectField
          label="Linked to"
          options={[{ value: "", label: "Nothing" }, ...Object.entries(LINK_LABEL).map(([value, label]) => ({ value, label }))]}
          {...r("linkType", { onChange: () => form.setValue("linkId", "") })}
        />
        {linkType ? (
          <SelectField
            label={LINK_LABEL[linkType]}
            required
            placeholder={`Choose ${LINK_LABEL[linkType].toLowerCase()}`}
            options={linkOptions[linkType]}
            error={errors.linkId?.message}
            {...r("linkId")}
          />
        ) : (
          <div className="hidden sm:block" />
        )}
      </FormGrid>
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      {!id && (
        <FormGrid>
          <Field label="Invoice / receipt" hint="Optional · PDF or image, up to 10 MB">
            <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          {file && (
            <Field label="Invoice number" htmlFor="f-invoiceNumber">
              <Input id="f-invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </Field>
          )}
        </FormGrid>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
