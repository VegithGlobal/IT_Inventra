"use client";

import { Archive, ArchiveRestore, LogIn, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { AssignDialog } from "@/features/assignments/dialogs";
import { NewTicketButton } from "@/features/tickets/quick-add";
import { quickReturn } from "@/features/assignments/actions";
import type { AssignOptions } from "@/features/assignments/queries";
import { archiveEmployees, deleteEmployees, restoreEmployees } from "./actions";
import { EmployeeForm } from "./employee-form";
import type { Lookups } from "./queries";
import type { EmployeeInput } from "./schema";

export function EmployeeActions({
  id,
  initial,
  lookups,
  assignOptions,
  canAssign,
  canDelete,
  archived,
  handoverDone,
}: {
  id: string;
  initial: EmployeeInput;
  lookups: Lookups;
  assignOptions: AssignOptions;
  canAssign: boolean;
  canDelete: boolean;
  archived: boolean;
  handoverDone: boolean;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <>
      {archived ? (
        <>
          {canDelete && (
            <ConfirmAction
              action={deleteEmployees}
              input={{ ids: [id] }}
              label="Delete"
              icon={<Trash2 />}
              variant="ghost"
              title={`Delete ${initial.name} permanently?`}
              description={
                handoverDone
                  ? "Handover is done. Removes the employee with their logins, assignment history, documents and the tickets they raised. Expenses and repairs are kept, and their name stays in each asset's previous users. This can't be undone."
                  : "Handover isn't finished yet — return their assets, revoke license seats and close their logins first, or the delete will be refused."
              }
              confirmLabel="Delete permanently"
              successMessage="Employee deleted"
              redirectTo="/employees?view=archived"
              danger
            />
          )}
          <ConfirmAction
            action={restoreEmployees}
            input={{ ids: [id] }}
            label="Restore"
            icon={<ArchiveRestore />}
            variant="ghost"
            title={`Restore ${initial.name}?`}
            description="Moves them back to the current employees list. Their status stays exited — edit them to make them active again."
            confirmLabel="Restore"
            successMessage="Employee restored"
          />
        </>
      ) : (
        <ConfirmAction
          action={archiveEmployees}
          input={{ ids: [id] }}
          label="Archive"
          icon={<Archive />}
          variant="ghost"
          title={`Archive ${initial.name}?`}
          description="Use this when they leave. They move to the Archived tab, are marked exited (exit date today if not set) and drop out of pickers. Collect their assets, revoke license seats and close logins, then delete them."
          confirmLabel="Archive"
          successMessage="Employee archived"
        />
      )}
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
