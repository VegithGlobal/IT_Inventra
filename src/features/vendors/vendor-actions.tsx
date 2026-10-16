"use client";

import { Archive } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { archiveVendor } from "./actions";
import type { VendorInput } from "./schema";
import { VendorForm } from "./vendor-form";

export function VendorActions({ id, initial }: { id: string; initial: VendorInput }) {
  return (
    <>
      <ConfirmAction
        action={archiveVendor}
        input={{ id }}
        label="Archive"
        icon={<Archive />}
        variant="ghost"
        title="Archive vendor?"
        description="The vendor is hidden from lists and pickers. Past assets, expenses and documents keep their link."
        confirmLabel="Archive"
        successMessage="Vendor archived"
        redirectTo="/vendors"
        danger
      />
      <EditSheet title="Edit vendor">{(close) => <VendorForm id={id} initial={initial} onDone={close} />}</EditSheet>
    </>
  );
}
