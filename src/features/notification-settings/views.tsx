"use client";

import { CheckCircle2, CircleSlash, Send } from "lucide-react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { FormError, InputField, useActionForm, useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormGrid } from "@/components/ui/field";
import { NOTIFICATION_META } from "@/features/notifications/meta";
import { saveEmailSettings, saveReminderSettings, sendTestEmail } from "./actions";
import { emailSettingsSchema, reminderSettingsSchema, type EmailSettingsInput, type ReminderSettingsInput } from "./schema";

export function ReminderDefaultsForm({ initial, readOnly }: { initial: ReminderSettingsInput; readOnly: boolean }) {
  const { form, submit, pending, errors, formError } = useActionForm(reminderSettingsSchema, saveReminderSettings, {
    defaultValues: initial,
    successMessage: "Reminder defaults saved",
  });
  const r = form.register;
  return (
    <Card>
      <CardHeader title="When to remind" description="Defaults for automatic reminders. A subscription can override its own days." />
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <FormError message={formError} />
          <fieldset disabled={readOnly} className="contents">
            <FormGrid>
              <InputField label="Subscription due — days before" hint="0 = on the due day" error={errors.subscriptionDaysBefore?.message} {...r("subscriptionDaysBefore")} />
              <InputField label="License expiry — days before" error={errors.licenseDaysBefore?.message} {...r("licenseDaysBefore")} />
              <InputField label="Warranty expiry — days before" inputMode="numeric" error={errors.warrantyDaysBefore?.message} {...r("warrantyDaysBefore")} />
              <InputField label="Asset return — days before" inputMode="numeric" error={errors.assetReturnDaysBefore?.message} {...r("assetReturnDaysBefore")} />
              <InputField label="Ticket due — hours before" inputMode="numeric" error={errors.ticketDueHoursBefore?.message} {...r("ticketDueHoursBefore")} />
            </FormGrid>
          </fieldset>
          <p className="text-[12.5px] text-fg-muted">Overdue payments, returns and repairs are re-sent weekly until resolved. Low stock fires when quantity reaches the reorder point.</p>
          {!readOnly && (
            <div className="flex justify-end border-t border-line pt-4">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

export function EmailSettingsForm({
  initial,
  readOnly,
  smtp,
}: {
  initial: EmailSettingsInput;
  readOnly: boolean;
  smtp: { host: string; port: number; secure: boolean; user: string | null; from: string } | null;
}) {
  const { form, submit, pending, formError } = useActionForm(emailSettingsSchema, saveEmailSettings, { defaultValues: initial, successMessage: "Email settings saved" });
  const test = useActionRunner();
  const types = Object.keys(initial) as (keyof EmailSettingsInput)[];
  return (
    <Card>
      <CardHeader
        title="Email"
        description="In-app notifications are always on. Choose which ones are also emailed (one digest per run)."
        action={
          !readOnly && (
            <Button size="sm" disabled={!smtp || test.pending} onClick={() => test.run(sendTestEmail, undefined, (r) => toast.success(`Test email sent to ${r.to}`))}>
              <Send />
              {test.pending ? "Sending…" : "Send test email"}
            </Button>
          )
        }
      />
      <CardBody className="flex flex-col gap-5">
        <div className="rounded-lg border border-line bg-subtle px-4 py-3">
          {smtp ? (
            <>
              <p className="mb-3 flex items-center gap-2 text-[13.5px] font-medium text-success">
                <CheckCircle2 className="size-4" /> SMTP configured
              </p>
              <DetailList
                items={[
                  { label: "Server", value: `${smtp.host}:${smtp.port}${smtp.secure ? " (TLS)" : ""}` },
                  { label: "Sends as", value: smtp.from },
                  { label: "Login", value: smtp.user ?? "None" },
                ]}
              />
            </>
          ) : (
            <p className="flex items-start gap-2 text-[13.5px] text-fg-secondary">
              <CircleSlash className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              <span>
                Email is off. Set <code className="rounded bg-surface px-1 text-[12px]">SMTP_HOST</code>, <code className="rounded bg-surface px-1 text-[12px]">SMTP_USER</code>,{" "}
                <code className="rounded bg-surface px-1 text-[12px]">SMTP_PASS</code> and <code className="rounded bg-surface px-1 text-[12px]">SMTP_FROM</code> in <code className="rounded bg-surface px-1 text-[12px]">.env</code>{" "}
                and restart the server. SMTP passwords are kept in the environment, never in the database.
              </span>
            </p>
          )}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError message={formError} />
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {types.map((t) => {
              const meta = NOTIFICATION_META[t];
              return (
                <li key={t}>
                  <Controller
                    control={form.control}
                    name={t}
                    render={({ field }) => (
                      <label className="flex items-center gap-3 text-[13.5px] text-fg">
                        <Checkbox checked={field.value} disabled={readOnly} onCheckedChange={(v) => field.onChange(!!v)} />
                        <meta.icon className="size-4 text-fg-muted" aria-hidden />
                        {meta.label}
                      </label>
                    )}
                  />
                </li>
              );
            })}
          </ul>
          {!readOnly && (
            <div className="flex justify-end border-t border-line pt-4">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
