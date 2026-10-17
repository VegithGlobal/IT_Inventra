"use client";

import { PackageMinus } from "lucide-react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { FormGrid } from "@/components/ui/field";
import { todayInput } from "@/lib/dates";
import { stockOut } from "./actions";
import { stockOutSchema } from "./schema";

export type StockPick = { id: string; name: string; unit: string; quantity: number };

/** "Use stock" on a ticket: pick an item and quantity; issued to the requester and linked to the ticket. */
export function UseStockButton({ items, ticketId, requesterId }: { items: StockPick[]; ticketId: string; requesterId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PackageMinus />
        Use stock
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Use stock on this ticket" description="Issued to the requester and logged on the ticket.">
        {open && <UseStockForm items={items} ticketId={ticketId} requesterId={requesterId} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function UseStockForm({ items, ticketId, requesterId, onDone }: { items: StockPick[]; ticketId: string; requesterId: string; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(stockOutSchema, stockOut, {
    defaultValues: { itemId: "", quantity: "1", employeeId: requesterId, ticketId, date: todayInput(), notes: "" },
    successMessage: "Stock used",
    onSuccess: onDone,
  });
  const r = form.register;
  const itemId = useWatch({ control: form.control, name: "itemId" });
  const item = items.find((i) => i.id === itemId);
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <SelectField
          label="Item"
          required
          className="sm:col-span-2"
          placeholder="Choose item"
          options={items.map((i) => ({ value: i.id, label: `${i.name} — ${i.quantity} ${i.unit} left` }))}
          error={errors.itemId?.message}
          {...r("itemId")}
        />
        <InputField label={`Quantity${item ? ` (${item.unit})` : ""}`} required inputMode="numeric" hint={item ? `${item.quantity} available` : undefined} error={errors.quantity?.message} {...r("quantity")} />
      </FormGrid>
      <TextareaField label="Note" rows={2} error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Use stock"}
        </Button>
      </div>
    </form>
  );
}
