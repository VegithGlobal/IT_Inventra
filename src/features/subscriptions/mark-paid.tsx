"use client";

import { useState } from "react";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, FormGrid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { advanceCycle } from "@/lib/billing";
import { addDays, todayInput } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE, toOptions } from "@/lib/options";
import type { BillingCycle, PaymentMode } from "@/generated/prisma/enums";
import { markSubscriptionPaid } from "./actions";
import { markPaidSchema } from "./schema";

export type PayTarget = {
  id: string;
  name: string;
  amount: number;
  nextDueDate: Date;
  billingCycle: BillingCycle;
  customCycleDays: number | null;
  paymentMode: PaymentMode | null;
};

export function MarkPaidDialog({ target, onOpenChange }: { target: PayTarget | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal open={!!target} onOpenChange={onOpenChange} title="Mark as paid" description={target?.name}>
      {target && <MarkPaidForm target={target} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function MarkPaidForm({ target, onDone }: { target: PayTarget; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const due = new Date(target.nextDueDate);
  const next = advanceCycle(due, target.billingCycle, target.customCycleDays);
  const { form, submit, pending, errors, formError } = useActionForm(
    markPaidSchema,
    (values) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) fd.set(k, v);
      if (file) fd.set("file", file);
      return markSubscriptionPaid(fd);
    },
    {
      defaultValues: {
        subscriptionId: target.id,
        paidAt: todayInput(),
        amount: target.amount.toFixed(2),
        taxAmount: "",
        paymentMode: target.paymentMode ?? "UPI",
        transactionRef: "",
        invoiceNumber: "",
        notes: "",
      },
      successMessage: `Payment recorded · next due ${formatDate(next)}`,
      onSuccess: onDone,
    },
  );
  const r = form.register;
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <div className="rounded-lg bg-subtle px-4 py-3 text-[13px] text-fg-secondary">
        Pays the period <span className="font-medium text-fg">{formatDate(due)}</span> – <span className="font-medium text-fg">{formatDate(addDays(next, -1))}</span>. The
        next due date moves to <span className="font-medium text-fg">{formatDate(next)}</span>, and a {formatMoney(target.amount)} expense is created
        automatically.
      </div>
      <FormGrid>
        <InputField label="Payment date" type="date" required error={errors.paidAt?.message} {...r("paidAt")} />
        <SelectField label="Payment mode" options={toOptions(PAYMENT_MODE)} {...r("paymentMode")} />
        <InputField label="Amount paid (₹)" required inputMode="decimal" error={errors.amount?.message} {...r("amount")} />
        <InputField label="GST included (₹)" inputMode="decimal" hint="Optional — split out on the expense" error={errors.taxAmount?.message} {...r("taxAmount")} />
        <InputField label="Transaction reference" placeholder="UPI / NEFT ref" error={errors.transactionRef?.message} {...r("transactionRef")} />
        <InputField label="Invoice number" error={errors.invoiceNumber?.message} {...r("invoiceNumber")} />
      </FormGrid>
      <Field label="Invoice" hint="Optional · PDF or image, up to 10 MB. Saved to Invoices and linked here.">
        <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
