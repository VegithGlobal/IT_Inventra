"use client";

import { useWatch } from "react-hook-form";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormGrid, FormSection } from "@/components/ui/field";
import { TICKET_PRIORITY, TICKET_SOURCE, TICKET_STATUS, toOptions } from "@/lib/options";
import { createTicket, updateTicket } from "./actions";
import type { TicketLookups } from "./queries";
import { ticketSchema, type TicketInput } from "./schema";

export const emptyTicket = (preset: Partial<TicketInput> = {}): TicketInput => ({
  title: "",
  requesterId: "",
  description: "",
  categoryId: "",
  priority: "MEDIUM",
  status: "OPEN",
  source: "WALK_IN",
  assetId: "",
  dueDate: "",
  dueTime: "",
  timeSpentMinutes: "",
  resolutionNotes: "",
  ...preset,
});

/** Assets held by the requester come first in the picker. */
export function assetOptions(assets: TicketLookups["assets"], requesterId: string) {
  const mine = assets.filter((a) => requesterId && a.currentHolderId === requesterId);
  const rest = assets.filter((a) => !mine.includes(a));
  return [
    ...mine.map((a) => ({ value: a.id, label: `★ ${a.assetTag} · ${a.name}` })),
    ...rest.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}` })),
  ];
}

export function TicketForm({ id, initial, lookups, onDone }: { id?: string; initial: TicketInput; lookups: TicketLookups; onDone: (r: { id: string }) => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(ticketSchema, (values) => (id ? updateTicket({ id, data: values }) : createTicket(values)), {
    defaultValues: initial,
    successMessage: id ? "Ticket updated" : "Ticket created",
    onSuccess: onDone,
  });
  const r = form.register;
  const [requesterId, status] = useWatch({ control: form.control, name: ["requesterId", "status"] });
  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FormError message={formError} />
      <FormSection title="Issue">
        <InputField label="Title" required error={errors.title?.message} {...r("title")} />
        <TextareaField label="Description" rows={4} error={errors.description?.message} {...r("description")} />
        <FormGrid>
          <SelectField
            label="Requester"
            required
            placeholder="Who is it for?"
            options={lookups.employees.map((e) => ({ value: e.id, label: e.name }))}
            error={errors.requesterId?.message}
            {...r("requesterId")}
          />
          <SelectField label="Category" placeholder="—" options={lookups.categories.map((c) => ({ value: c.id, label: c.name }))} {...r("categoryId")} />
          <SelectField label="Priority" options={toOptions(TICKET_PRIORITY)} {...r("priority")} />
          <SelectField label="Status" options={toOptions(TICKET_STATUS)} {...r("status")} />
          <SelectField label="Source" options={toOptions(TICKET_SOURCE)} {...r("source")} />
          <SelectField label="Asset" placeholder="—" hint="★ = held by the requester" options={assetOptions(lookups.assets, requesterId)} {...r("assetId")} />
          <InputField label="Due date" type="date" error={errors.dueDate?.message} {...r("dueDate")} />
          <InputField label="Due time (IST)" type="time" hint="Defaults to 18:00" error={errors.dueTime?.message} {...r("dueTime")} />
        </FormGrid>
      </FormSection>
      <FormSection title="Work">
        <FormGrid>
          <InputField label="Time spent (minutes)" inputMode="numeric" error={errors.timeSpentMinutes?.message} {...r("timeSpentMinutes")} />
        </FormGrid>
        {(status === "RESOLVED" || status === "CLOSED" || initial.resolutionNotes) && (
          <TextareaField label="Resolution notes" rows={3} placeholder="What fixed it?" error={errors.resolutionNotes?.message} {...r("resolutionNotes")} />
        )}
      </FormSection>
      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Create ticket"}
        </Button>
      </div>
    </form>
  );
}
