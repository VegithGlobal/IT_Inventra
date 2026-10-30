"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormGrid, FormSection } from "@/components/ui/field";
import { advanceCycle, firstDueOnOrAfter } from "@/lib/billing";
import { parseDateInput, today, todayInput } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { BILLING_CYCLE, PAYMENT_MODE, SUBSCRIPTION_CATEGORY, SUBSCRIPTION_STATUS, toOptions } from "@/lib/options";
import type { Lookups } from "@/features/employees/queries";
import { createSubscription, updateSubscription } from "./actions";
import { subscriptionSchema, type SubscriptionInput } from "./schema";

const NEW_CATEGORY = "__new__";

export const emptySubscription = (): SubscriptionInput => ({
  name: "",
  category: "ISP",
  vendorId: "",
  accountId: "",
  planDetails: "",
  amount: "",
  currency: "INR",
  billingCycle: "MONTHLY",
  customCycleDays: "",
  startDate: todayInput(),
  nextDueDate: "",
  autoRenew: false,
  paymentMode: "",
  locationId: "",
  departmentId: "",
  loginUrl: "",
  credentials: "",
  clearCredentials: false,
  reminderDays: "",
  status: "ACTIVE",
  notes: "",
});

export function SubscriptionForm({
  id,
  initial,
  lookups,
  hasCredentials,
  onDone,
}: {
  id?: string;
  initial?: SubscriptionInput;
  lookups: Pick<Lookups, "vendors" | "locations" | "departments" | "subscriptionCategories">;
  hasCredentials?: boolean;
  onDone: (r: { id: string }) => void;
}) {
  const { form, submit, pending, errors, formError } = useActionForm(
    subscriptionSchema,
    (values) => (id ? updateSubscription({ id, data: values }) : createSubscription(values)),
    { defaultValues: initial ?? emptySubscription(), successMessage: id ? "Subscription updated" : "Subscription added", onSuccess: onDone },
  );
  const r = form.register;
  const [cycle, customDays, startDate, nextDueDate] = useWatch({ control: form.control, name: ["billingCycle", "customCycleDays", "startDate", "nextDueDate"] });
  const opts = (list: { id: string; name: string }[]) => list.map((x) => ({ value: x.id, label: x.name }));

  // Built-in categories, then any the team has added, then "add new" — which
  // swaps the select for a text box; the typed name is saved as the category.
  const [addingCategory, setAddingCategory] = useState(false);
  const categoryOptions = [
    ...toOptions(SUBSCRIPTION_CATEGORY),
    ...lookups.subscriptionCategories.filter((c) => !(c in SUBSCRIPTION_CATEGORY)).sort().map((c) => ({ value: c, label: c })),
    { value: NEW_CATEGORY, label: "+ Add new category…" },
  ];
  const categoryField = r("category");

  // Live preview of the auto-calculated due date when the field is left blank.
  let preview: string | null = null;
  if (!nextDueDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const days = cycle === "CUSTOM" ? Number(customDays) || null : null;
    if (cycle !== "CUSTOM" || days) {
      const due = firstDueOnOrAfter(parseDateInput(startDate), today(), cycle, days);
      preview = `Will be ${formatDate(due)}, then ${formatDate(advanceCycle(due, cycle, days))}`;
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <FormSection title="Service">
        <FormGrid>
          <InputField label="Service name" required className="sm:col-span-2" placeholder="Airtel Xstream Fiber · Pune HQ" error={errors.name?.message} {...r("name")} />
          {addingCategory ? (
            <div className="flex flex-col gap-1.5">
              <InputField label="New category" required autoFocus placeholder="e.g. CCTV cloud storage" error={errors.category?.message} {...categoryField} />
              <button
                type="button"
                className="self-start text-[12.5px] text-fg-muted underline underline-offset-2 hover:text-fg"
                onClick={() => {
                  setAddingCategory(false);
                  form.setValue("category", initial?.category ?? "ISP");
                }}
              >
                Cancel — pick from the list
              </button>
            </div>
          ) : (
            <SelectField
              label="Category"
              options={categoryOptions}
              error={errors.category?.message}
              {...categoryField}
              onChange={(e) => {
                if (e.target.value === NEW_CATEGORY) {
                  setAddingCategory(true);
                  form.setValue("category", "");
                  return;
                }
                return categoryField.onChange(e);
              }}
            />
          )}
          <SelectField label="Provider / vendor" placeholder="—" options={opts(lookups.vendors)} {...r("vendorId")} />
          <InputField label="Account / customer ID" error={errors.accountId?.message} {...r("accountId")} />
          <SelectField label="Status" options={toOptions(SUBSCRIPTION_STATUS)} {...r("status")} />
        </FormGrid>
        <TextareaField label="Plan details" rows={2} placeholder="300 Mbps unlimited, static IP" error={errors.planDetails?.message} {...r("planDetails")} />
      </FormSection>

      <FormSection title="Billing">
        <FormGrid>
          <InputField label="Amount per cycle" required inputMode="decimal" placeholder="2359.00" error={errors.amount?.message} {...r("amount")} />
          <InputField label="Currency" maxLength={3} className="[&_input]:uppercase" error={errors.currency?.message} {...r("currency")} />
          <SelectField label="Billing cycle" options={toOptions(BILLING_CYCLE)} {...r("billingCycle")} />
          {cycle === "CUSTOM" ? (
            <InputField label="Cycle length (days)" inputMode="numeric" required error={errors.customCycleDays?.message} {...r("customCycleDays")} />
          ) : (
            <SelectField label="Payment method" placeholder="—" options={toOptions(PAYMENT_MODE)} {...r("paymentMode")} />
          )}
          <InputField label="Start date" type="date" required error={errors.startDate?.message} {...r("startDate")} />
          <InputField
            label="Next due date"
            type="date"
            hint={preview ?? "Leave blank to calculate from the start date"}
            error={errors.nextDueDate?.message}
            {...r("nextDueDate")}
          />
          {cycle === "CUSTOM" && <SelectField label="Payment method" placeholder="—" options={toOptions(PAYMENT_MODE)} {...r("paymentMode")} />}
          <InputField label="Reminder days before due" placeholder="7, 3, 1, 0" hint="Blank = default from Settings" error={errors.reminderDays?.message} {...r("reminderDays")} />
        </FormGrid>
        <label className="flex items-center gap-2 text-[13.5px] text-fg">
          <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("autoRenew")} />
          Auto-renews (charged automatically)
        </label>
      </FormSection>

      <FormSection title="Ownership & access">
        <FormGrid>
          <SelectField label="Location" placeholder="—" options={opts(lookups.locations)} {...r("locationId")} />
          <SelectField label="Department" placeholder="—" options={opts(lookups.departments)} {...r("departmentId")} />
          <InputField label="Login URL" type="url" placeholder="https://" className="sm:col-span-2" error={errors.loginUrl?.message} {...r("loginUrl")} />
        </FormGrid>
        <TextareaField
          label="Credentials (stored encrypted)"
          rows={2}
          autoComplete="off"
          placeholder={hasCredentials ? "•••••••• saved — type to replace" : "Username / password or a reference to your password manager"}
          hint="Encrypted with AES-256 before saving. Prefer a password-manager reference where possible."
          error={errors.credentials?.message}
          {...r("credentials")}
        />
        {hasCredentials && (
          <label className="flex items-center gap-2 text-[13.5px] text-fg">
            <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("clearCredentials")} />
            Remove the saved credentials
          </label>
        )}
        <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      </FormSection>

      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add subscription"}
        </Button>
      </div>
    </form>
  );
}
