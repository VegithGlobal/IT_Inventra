"use server";

import { z } from "zod";
import type { AssetStatus } from "@/generated/prisma/enums";
import { ActionError, createAction, type ActionContext } from "@/lib/action";
import { parseDateInput, parseOptionalDate } from "@/lib/dates";
import { toDecimalOrNull } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { systemCategoryId } from "@/features/expenses/system";
import { closeMaintenanceSchema, maintenanceSchema, maintenanceUpdateSchema, type MaintenanceInput } from "./schema";

const toData = (v: MaintenanceInput) => ({
  assetId: v.assetId,
  issue: v.issue,
  sentAt: parseDateInput(v.sentAt),
  vendorId: orNull(v.vendorId),
  expectedReturnAt: parseOptionalDate(v.expectedReturnAt),
  underWarranty: v.underWarranty,
  cost: toDecimalOrNull(v.cost),
  ticketId: orNull(v.ticketId),
  notes: orNull(v.notes),
});

/** Keeps exactly one active expense in step with the repair's cost (creates, updates or archives it). */
async function syncExpense(ctx: ActionContext, recordId: string, opts: { archive?: boolean } = {}) {
  const { tx, audit } = ctx;
  const r = await tx.maintenanceRecord.findUniqueOrThrow({ where: { id: recordId }, include: { asset: { select: { assetTag: true } } } });
  const existing = await tx.expense.findFirst({ where: { maintenanceId: r.id, source: "MAINTENANCE", deletedAt: null } });
  const hasCost = !opts.archive && r.cost && r.cost.greaterThan(0);
  if (!hasCost) {
    if (existing) {
      const after = await tx.expense.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
      await audit({ action: "DELETE", entityType: "Expense", entityId: existing.id, entityLabel: existing.description, before: existing, after });
    }
    return;
  }
  const data = {
    date: r.returnedAt ?? r.sentAt,
    description: `Repair · ${r.asset.assetTag} · ${r.issue}`.slice(0, 300),
    amount: r.cost!,
    total: r.cost!,
    vendorId: r.vendorId,
    assetId: r.assetId,
    ticketId: r.ticketId,
  };
  if (existing) {
    // Only rewrite fields this sync owns; keep any GST split / payment details entered by hand.
    const unchanged = existing.total.equals(r.cost!) && existing.date.getTime() === data.date.getTime() && existing.vendorId === data.vendorId;
    if (unchanged) return;
    const after = await tx.expense.update({
      where: { id: existing.id },
      data: { ...data, amount: existing.total.equals(r.cost!) ? existing.amount : r.cost!, taxAmount: existing.total.equals(r.cost!) ? existing.taxAmount : 0 },
    });
    await audit({ action: "UPDATE", entityType: "Expense", entityId: existing.id, entityLabel: after.description, before: existing, after });
    return;
  }
  const created = await tx.expense.create({
    data: { ...data, taxAmount: 0, categoryId: await systemCategoryId(tx, "maintenance"), source: "MAINTENANCE", maintenanceId: r.id },
  });
  await audit({ action: "CREATE", entityType: "Expense", entityId: created.id, entityLabel: created.description, after: created });
}

async function ticketNote(ctx: ActionContext, ticketId: string | null, body: string) {
  if (ticketId) await ctx.tx.ticketComment.create({ data: { ticketId, authorId: ctx.user.id, kind: "SYSTEM", body } });
}

export const openMaintenance = createAction({
  schema: maintenanceSchema,
  handler: async (input, ctx) => {
    const { tx, audit } = ctx;
    const asset = await tx.asset.findFirst({ where: { id: input.assetId, deletedAt: null } });
    if (!asset) throw new ActionError("Asset not found.");
    if (asset.status === "DISPOSED") throw new ActionError(`${asset.assetTag} is disposed.`);
    const open = await tx.maintenanceRecord.findFirst({ where: { assetId: asset.id, status: "OPEN", deletedAt: null } });
    if (open) throw new ActionError(`${asset.assetTag} already has an open repair. Close it first.`);

    // If it was already marked Under repair (e.g. at check-in), it goes back to stock afterwards.
    const previous: AssetStatus = asset.status === "UNDER_REPAIR" ? "IN_STOCK" : asset.status;
    const record = await tx.maintenanceRecord.create({ data: { ...toData(input), status: "OPEN", previousAssetStatus: previous } });
    const after = await tx.asset.update({ where: { id: asset.id }, data: { status: "UNDER_REPAIR" } });
    await audit({ action: "CREATE", entityType: "MaintenanceRecord", entityId: record.id, entityLabel: `${asset.assetTag} · ${record.issue}`, after: record });
    if (asset.status !== "UNDER_REPAIR") await audit({ action: "UPDATE", entityType: "Asset", entityId: asset.id, entityLabel: asset.assetTag, before: asset, after });
    await syncExpense(ctx, record.id);
    const vendor = record.vendorId ? await tx.vendor.findUnique({ where: { id: record.vendorId }, select: { name: true } }) : null;
    await ticketNote(ctx, record.ticketId, `${asset.assetTag} sent for repair${vendor ? ` to ${vendor.name}` : ""}`);
    return { id: record.id };
  },
});

export const updateMaintenance = createAction({
  schema: maintenanceUpdateSchema,
  handler: async ({ id, data }, ctx) => {
    const before = await ctx.tx.maintenanceRecord.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Repair record not found.");
    if (before.assetId !== data.assetId) throw new ActionError("The asset can't change on an existing repair. Archive it and log a new one.");
    const after = await ctx.tx.maintenanceRecord.update({ where: { id }, data: toData(data) });
    await ctx.audit({ action: "UPDATE", entityType: "MaintenanceRecord", entityId: id, entityLabel: after.issue, before, after });
    await syncExpense(ctx, id);
    return { id };
  },
});

export const closeMaintenance = createAction({
  schema: closeMaintenanceSchema,
  handler: async (v, ctx) => {
    const { tx, audit } = ctx;
    const before = await tx.maintenanceRecord.findFirst({ where: { id: v.id, deletedAt: null }, include: { asset: true } });
    if (!before) throw new ActionError("Repair record not found.");
    if (before.status === "CLOSED") throw new ActionError("This repair is already closed.");
    const returnedAt = parseDateInput(v.returnedAt);
    if (returnedAt < before.sentAt) throw new ActionError("Return date can't be before the date sent.", { returnedAt: "Must be on or after the date sent" });

    const after = await tx.maintenanceRecord.update({
      where: { id: v.id },
      data: { status: "CLOSED", returnedAt, outcome: v.outcome, cost: v.cost ? toDecimalOrNull(v.cost) : before.cost },
    });
    await audit({ action: "UPDATE", entityType: "MaintenanceRecord", entityId: v.id, entityLabel: after.issue, before: { ...before, asset: undefined }, after });

    // Restore the asset — unless someone already moved it out of "Under repair".
    const asset = before.asset;
    if (asset.status === "UNDER_REPAIR") {
      let status: AssetStatus = v.assetStatus === "PREVIOUS" ? (before.previousAssetStatus ?? "IN_STOCK") : v.assetStatus;
      if (status === "ASSIGNED" && !(await tx.assetAssignment.findFirst({ where: { assetId: asset.id, returnedAt: null } }))) status = "IN_STOCK";
      if (status === "UNDER_REPAIR") status = "IN_STOCK";
      const updated = await tx.asset.update({ where: { id: asset.id }, data: { status, condition: v.condition } });
      await audit({ action: "UPDATE", entityType: "Asset", entityId: asset.id, entityLabel: asset.assetTag, before: asset, after: updated });
    }
    await syncExpense(ctx, v.id);
    await ticketNote(ctx, before.ticketId, `${asset.assetTag} back from repair: ${v.outcome}`);
    return { id: v.id };
  },
});

export const archiveMaintenance = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, ctx) => {
    const { tx, audit } = ctx;
    const before = await tx.maintenanceRecord.findFirst({ where: { id, deletedAt: null }, include: { asset: true } });
    if (!before) throw new ActionError("Repair record not found.");
    const after = await tx.maintenanceRecord.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "MaintenanceRecord", entityId: id, entityLabel: before.issue, before: { ...before, asset: undefined }, after });
    // An open repair logged by mistake: put the asset back.
    if (before.status === "OPEN" && before.asset.status === "UNDER_REPAIR") {
      let status: AssetStatus = before.previousAssetStatus ?? "IN_STOCK";
      if (status === "ASSIGNED" && !(await tx.assetAssignment.findFirst({ where: { assetId: before.assetId, returnedAt: null } }))) status = "IN_STOCK";
      const updated = await tx.asset.update({ where: { id: before.assetId }, data: { status } });
      await audit({ action: "UPDATE", entityType: "Asset", entityId: before.assetId, entityLabel: before.asset.assetTag, before: before.asset, after: updated });
    }
    await syncExpense(ctx, id, { archive: true });
    return { id };
  },
});
