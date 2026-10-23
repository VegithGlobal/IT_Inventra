"use client";

import { Archive, ArrowLeftRight, LogIn, LogOut, MoreHorizontal, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActionRunner } from "@/components/forms";
import { EditSheet } from "@/components/edit-sheet";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import type { Lookups } from "@/features/employees/queries";
import { AssignDialog, CheckInDialog, TransferDialog } from "@/features/assignments/dialogs";
import type { AssignOptions } from "@/features/assignments/queries";
import { archiveAsset, deleteAssets } from "./actions";
import { AssetForm } from "./asset-form";
import type { AssetInput } from "./schema";

export function AssetActions({
  asset,
  initial,
  lookups,
  assignOptions,
  openAssignment,
  canDelete,
}: {
  asset: { id: string; assetTag: string; name: string; status: string };
  initial: AssetInput;
  lookups: Lookups;
  assignOptions: AssignOptions;
  openAssignment: { id: string; employeeId: string; employeeName: string; condition: "NEW" | "GOOD" | "FAIR" | "POOR" } | null;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"assign" | "checkin" | "transfer" | "archive" | "delete" | null>(null);
  const { pending, run } = useActionRunner();
  const close = (o: boolean) => !o && setDialog(null);
  const assignable = !openAssignment && !["LOST_STOLEN", "DISPOSED", "RETIRED"].includes(asset.status);
  // The asset itself must be selectable in the assign dialog even if filters would hide it.
  const options: AssignOptions = assignOptions.assets.some((a) => a.id === asset.id)
    ? assignOptions
    : { ...assignOptions, assets: [{ id: asset.id, assetTag: asset.assetTag, name: asset.name, condition: initial.condition, status: "IN_STOCK" }, ...assignOptions.assets] };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem asChild>
            <Link href={`/print/labels?ids=${asset.id}`} target="_blank">
              <Printer /> Print QR label
            </Link>
          </MenuItem>
          <MenuItem danger disabled={!!openAssignment} onSelect={() => setDialog("archive")}>
            <Archive /> Archive asset
          </MenuItem>
          {canDelete && (
            <MenuItem danger onSelect={() => setDialog("delete")}>
              <Trash2 /> Delete permanently
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
      <EditSheet title={`Edit ${asset.assetTag}`}>
        {(done) => <AssetForm id={asset.id} initial={initial} lookups={lookups} onDone={done} />}
      </EditSheet>
      {openAssignment ? (
        <>
          <Button size="sm" onClick={() => setDialog("transfer")}>
            <ArrowLeftRight />
            Transfer
          </Button>
          <Button size="sm" variant="primary" onClick={() => setDialog("checkin")}>
            <LogIn />
            Check in
          </Button>
        </>
      ) : (
        <Button size="sm" variant="primary" disabled={!assignable} onClick={() => setDialog("assign")}>
          <LogOut />
          Assign
        </Button>
      )}

      <AssignDialog open={dialog === "assign"} onOpenChange={close} options={options} assetId={asset.id} />
      {openAssignment && (
        <>
          <CheckInDialog
            open={dialog === "checkin"}
            onOpenChange={close}
            assignmentId={openAssignment.id}
            label={`${asset.assetTag} from ${openAssignment.employeeName}`}
            defaultCondition={openAssignment.condition}
          />
          <TransferDialog
            open={dialog === "transfer"}
            onOpenChange={close}
            assetId={asset.id}
            label={`${asset.assetTag} · currently with ${openAssignment.employeeName}`}
            employees={assignOptions.employees}
            currentEmployeeId={openAssignment.employeeId}
          />
        </>
      )}
      <Modal
        open={dialog === "archive"}
        onOpenChange={close}
        title={`Archive ${asset.assetTag}?`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" disabled={pending} onClick={() => run(() => archiveAsset({ id: asset.id }), "Asset archived", () => router.push("/assets"))}>
              Archive
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-fg-secondary">The asset disappears from lists but its history, expenses and documents are kept.</p>
      </Modal>
      <Modal
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Delete ${asset.assetTag} permanently?`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" disabled={pending} onClick={() => run(() => deleteAssets({ ids: [asset.id] }), "Asset deleted", () => router.push("/assets"))}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-fg-secondary">
          Removes the asset with its assignment history, repairs and documents. This can&apos;t be undone.
          {openAssignment && ` It's currently assigned to ${openAssignment.employeeName}.`}
        </p>
      </Modal>
    </>
  );
}
