"use server";

import type { AssetCondition } from "@/generated/prisma/enums";
import { ActionError, createAction, type ActionContext } from "@/lib/action";
import { parseDateInput, parseOptionalDate, today } from "@/lib/dates";
import { saveUpload, storage, UploadError } from "@/lib/storage";
import { orNull } from "@/lib/validation";
import { assignActionSchema, checkInActionSchema, quickReturnSchema, transferSchema } from "./schema";

const accessoriesList = (s: string) =>
  s
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

async function attachForm(
  ctx: ActionContext,
  file: File | undefined,
  kind: "HANDOVER_FORM" | "RETURN_FORM",
  link: { assetId: string; employeeId: string; assignmentId: string; label: string },
) {
  if (!file) return;
  let stored;
  try {
    stored = await saveUpload(file, "documents");
  } catch (e) {
    if (e instanceof UploadError) throw new ActionError(e.message, { file: e.message });
    throw e;
  }
  try {
    const doc = await ctx.tx.document.create({
      data: {
        type: kind,
        title: `${kind === "HANDOVER_FORM" ? "Signed handover form" : "Signed return form"} · ${link.label}`,
        ...stored,
        assetId: link.assetId,
        employeeId: link.employeeId,
        assignmentId: link.assignmentId,
        uploadedById: ctx.user.id,
      },
    });
    await ctx.audit({ action: "CREATE", entityType: "Document", entityId: doc.id, entityLabel: doc.title, after: doc });
  } catch (e) {
    await storage.delete(stored.fileKey);
    throw e;
  }
}

/** Check-out core, shared by assign and transfer. */
async function checkOut(
  ctx: ActionContext,
  v: { assetId: string; employeeId: string; issuedAt: Date; expectedReturnAt: Date | null; condition: AssetCondition; accessories: string; notes: string },
) {
  const { tx, audit, user } = ctx;
  const before = await tx.asset.findFirst({ where: { id: v.assetId, deletedAt: null } });
  if (!before) throw new ActionError("Asset not found.");
  if (before.status === "ASSIGNED") throw new ActionError(`${before.assetTag} is already assigned. Check it in or transfer it.`);
  if (["LOST_STOLEN", "DISPOSED", "RETIRED"].includes(before.status)) throw new ActionError(`${before.assetTag} is ${before.status.toLowerCase().replace("_", "/")} and can't be assigned.`);
  // An assigned laptop can be away for repair (status UNDER_REPAIR) while its assignment stays open.
  const [openAssignment, openRepair] = await Promise.all([
    tx.assetAssignment.findFirst({ where: { assetId: v.assetId, returnedAt: null } }),
    tx.maintenanceRecord.findFirst({ where: { assetId: v.assetId, status: "OPEN", deletedAt: null } }),
  ]);
  if (openAssignment) throw new ActionError(`${before.assetTag} is still checked out. Check it in or transfer it.`);
  if (openRepair) throw new ActionError(`${before.assetTag} is out for repair. Close the repair first.`);
  const employee = await tx.employee.findFirst({ where: { id: v.employeeId, deletedAt: null } });
  if (!employee) throw new ActionError("Employee not found.");
  if (employee.status === "EXITED") throw new ActionError(`${employee.name} has exited and can't receive assets.`);

  const assignment = await tx.assetAssignment.create({
    data: {
      assetId: v.assetId,
      employeeId: v.employeeId,
      issuedAt: v.issuedAt,
      expectedReturnAt: v.expectedReturnAt,
      conditionAtIssue: v.condition,
      accessories: accessoriesList(v.accessories),
      issueNotes: orNull(v.notes),
      issuedById: user.id,
    },
  });
  const after = await tx.asset.update({
    where: { id: v.assetId },
    data: {
      status: "ASSIGNED",
      currentHolderId: employee.id,
      condition: v.condition,
      departmentId: employee.departmentId ?? before.departmentId,
      locationId: employee.locationId ?? before.locationId,
    },
  });
  await audit({ action: "CREATE", entityType: "AssetAssignment", entityId: assignment.id, entityLabel: `${before.assetTag} → ${employee.name}`, after: assignment });
  await audit({ action: "UPDATE", entityType: "Asset", entityId: before.id, entityLabel: before.assetTag, before, after });
  return { assignment, asset: after, employee };
}

/** Check-in core, shared by check-in, transfer and quick return. */
async function checkIn(
  ctx: ActionContext,
  v: { assignmentId: string; returnedAt: Date; condition: AssetCondition; newStatus: "IN_STOCK" | "UNDER_REPAIR"; damageNotes: string; returnNotes: string },
) {
  const { tx, audit, user } = ctx;
  const open = await tx.assetAssignment.findUnique({ where: { id: v.assignmentId }, include: { asset: true, employee: true } });
  if (!open) throw new ActionError("Assignment not found.");
  if (open.returnedAt) throw new ActionError("This assignment was already checked in.");
  if (v.returnedAt < open.issuedAt) throw new ActionError("Return date can't be before the issue date.", { returnedAt: "Must be on or after the issue date" });

  const assignment = await tx.assetAssignment.update({
    where: { id: open.id },
    data: {
      returnedAt: v.returnedAt,
      conditionAtReturn: v.condition,
      damageNotes: orNull(v.damageNotes),
      returnNotes: orNull(v.returnNotes),
      receivedById: user.id,
    },
  });
  const after = await tx.asset.update({
    where: { id: open.assetId },
    data: { status: v.newStatus, currentHolderId: null, condition: v.condition },
  });
  await audit({
    action: "UPDATE",
    entityType: "AssetAssignment",
    entityId: open.id,
    entityLabel: `${open.asset.assetTag} ← ${open.employee.name}`,
    before: { ...open, asset: undefined, employee: undefined },
    after: assignment,
  });
  await audit({ action: "UPDATE", entityType: "Asset", entityId: open.assetId, entityLabel: open.asset.assetTag, before: open.asset, after });
  return { assignment, asset: open.asset, employee: open.employee };
}

export const assignAsset = createAction({
  schema: assignActionSchema,
  handler: async (v, ctx) => {
    const { assignment, asset, employee } = await checkOut(ctx, {
      assetId: v.assetId,
      employeeId: v.employeeId,
      issuedAt: parseDateInput(v.issuedAt),
      expectedReturnAt: parseOptionalDate(v.expectedReturnAt),
      condition: v.conditionAtIssue,
      accessories: v.accessories,
      notes: v.notes,
    });
    await attachForm(ctx, v.file, "HANDOVER_FORM", { assetId: asset.id, employeeId: employee.id, assignmentId: assignment.id, label: `${asset.assetTag} → ${employee.name}` });
    return { assignmentId: assignment.id };
  },
});

export const checkInAsset = createAction({
  schema: checkInActionSchema,
  handler: async (v, ctx) => {
    const { assignment, asset, employee } = await checkIn(ctx, {
      assignmentId: v.assignmentId,
      returnedAt: parseDateInput(v.returnedAt),
      condition: v.conditionAtReturn,
      newStatus: v.newStatus,
      damageNotes: v.damageNotes,
      returnNotes: v.returnNotes,
    });
    await attachForm(ctx, v.file, "RETURN_FORM", { assetId: asset.id, employeeId: employee.id, assignmentId: assignment.id, label: `${asset.assetTag} ← ${employee.name}` });
    return { assignmentId: assignment.id };
  },
});

/** Transfer = check-in from the current holder + check-out to the new one, same day. */
export const transferAsset = createAction({
  schema: transferSchema,
  handler: async (v, ctx) => {
    const open = await ctx.tx.assetAssignment.findFirst({ where: { assetId: v.assetId, returnedAt: null } });
    if (!open) throw new ActionError("This asset isn't assigned to anyone. Use Assign instead.");
    if (open.employeeId === v.toEmployeeId) throw new ActionError("The asset is already with this employee.", { toEmployeeId: "Pick a different employee" });
    const date = parseDateInput(v.date);
    await checkIn(ctx, { assignmentId: open.id, returnedAt: date, condition: v.condition, newStatus: "IN_STOCK", damageNotes: "", returnNotes: "Transferred" });
    const { assignment } = await checkOut(ctx, {
      assetId: v.assetId,
      employeeId: v.toEmployeeId,
      issuedAt: date,
      expectedReturnAt: null,
      condition: v.condition,
      accessories: v.accessories,
      notes: v.notes || "Transferred",
    });
    return { assignmentId: assignment.id };
  },
});

/** Offboarding helper: return today in the condition it was issued, back to stock. */
export const quickReturn = createAction({
  schema: quickReturnSchema,
  handler: async ({ assignmentId }, ctx) => {
    const open = await ctx.tx.assetAssignment.findUnique({ where: { id: assignmentId } });
    if (!open) throw new ActionError("Assignment not found.");
    const t = today();
    await checkIn(ctx, {
      assignmentId,
      returnedAt: t < open.issuedAt ? open.issuedAt : t,
      condition: open.conditionAtIssue,
      newStatus: "IN_STOCK",
      damageNotes: "",
      returnNotes: "Returned during offboarding",
    });
    return { assignmentId };
  },
});
