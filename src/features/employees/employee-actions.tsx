"use client";

import { Archive, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { AssignDialog } from "@/features/assignments/dialogs";
import { NewTicketButton } from "@/features/tickets/quick-add";
import { quickReturn } from "@/features/assignments/actions";
import type { AssignOptions } from "@/features/assignments/queries";
import { archiveEmployee } from "./actions";
import { EmployeeForm } from "./employee-form";
import type { Lookups } from "./queries";
import type { EmployeeInput } from "./schema";

export function EmployeeActions({
  id,
  initial,
  lookups,
  assignOptions,
  canAssign,
}: {
  id: string;
  initial: EmployeeInput;
  lookups: Lookups;
  assignOptions: AssignOptions;
  canAssign: boolean;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <>
      <ConfirmAction
        action={archiveEmployee}
        input={{ id }}
        label="Archive"
        icon={<Archive />}
        variant="ghost"
        title="Archive employee?"
        description="They disappear from lists and pickers. Their assignment history is kept. Employees still holding assets, license seats or active logins can't be archived."
        confirmLabel="Archive"
        successMessage="Employee archived"
        redirectTo="/employees"
        danger
      />
      {canAssign && <NewTicketButton label="New ticket" preset={{ requesterId: id }} />}
      <EditSheet title="Edit employee">{(close) => <EmployeeForm id={id} initial={initial} lookups={lookups} onDone={close} />}</EditSheet>
      {canAssign && (
        <Button size="sm" variant="primary" onClick={() => setAssignOpen(true)}>
          <LogOut />
          Assign asset
        </Button>
      )}
      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} options={assignOptions} employeeId={id} />
    </>
  );
}

/** One-click return used by the offboarding banner. */
export function QuickReturnButton({ assignmentId, label }: { assignmentId: string; label: string }) {
  const { pending, run } = useActionRunner();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(() => quickReturn({ assignmentId }), `${label} returned to stock`)}>
      <LogIn />
      {pending ? "Returning…" : "Return"}
    </Button>
  );
}
