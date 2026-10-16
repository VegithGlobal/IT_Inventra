"use client";

import { Archive, Eye, EyeOff, Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import type { Lookups } from "@/features/employees/queries";
import { archiveSubscription, revealCredentials, voidLatestPayment } from "./actions";
import { MarkPaidDialog, type PayTarget } from "./mark-paid";
import type { SubscriptionInput } from "./schema";
import { SubscriptionForm } from "./subscription-form";

export function SubscriptionActions({
  target,
  initial,
  lookups,
  hasCredentials,
  cancelled,
}: {
  target: PayTarget;
  initial: SubscriptionInput;
  lookups: Lookups;
  hasCredentials: boolean;
  cancelled: boolean;
}) {
  const [paying, setPaying] = useState(false);
  return (
    <>
      <ConfirmAction
        action={archiveSubscription}
        input={{ id: target.id }}
        label="Archive"
        icon={<Archive />}
        variant="ghost"
        title="Archive subscription?"
        description="It's marked cancelled and hidden. Payment history and expenses stay in reports."
        confirmLabel="Archive"
        successMessage="Subscription archived"
        redirectTo="/subscriptions"
        danger
      />
      <EditSheet title="Edit subscription">
        {(close) => <SubscriptionForm id={target.id} initial={initial} lookups={lookups} hasCredentials={hasCredentials} onDone={close} />}
      </EditSheet>
      {!cancelled && (
        <Button size="sm" variant="primary" onClick={() => setPaying(true)}>
          <Wallet />
          Mark as paid
        </Button>
      )}
      <MarkPaidDialog target={paying ? target : null} onOpenChange={setPaying} />
    </>
  );
}

/** Shows decrypted credentials on demand; hides again on click. */
export function RevealCredentials({ id }: { id: string }) {
  const [value, setValue] = useState<string | null>(null);
  const { pending, run } = useActionRunner();
  if (value !== null) {
    return (
      <span className="flex items-start gap-2">
        <code className="rounded bg-subtle px-2 py-1 font-mono text-[12.5px] whitespace-pre-wrap text-fg">{value}</code>
        <Button size="icon-sm" variant="ghost" aria-label="Hide credentials" onClick={() => setValue(null)}>
          <EyeOff />
        </Button>
      </span>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="-ml-3" disabled={pending} onClick={() => run(() => revealCredentials({ id }), undefined, (r) => setValue(r.value))}>
      <Eye />
      {pending ? "Decrypting…" : "Reveal"}
    </Button>
  );
}

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  return (
    <ConfirmAction
      action={voidLatestPayment}
      input={{ paymentId }}
      label="Void"
      icon={<Undo2 />}
      variant="ghost"
      title="Void this payment?"
      description="Use this to undo a payment recorded by mistake. The payment is removed, its expense is archived and the next due date moves back."
      confirmLabel="Void payment"
      successMessage="Payment voided"
      danger
    />
  );
}
