"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { decrypt, encrypt } from "@/lib/crypto";
import { parseOptionalDate } from "@/lib/dates";
import { toDecimalOrNull } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { systemCategoryId } from "@/features/expenses/system";
import { assignSeatSchema, licenseSchema, licenseUpdateSchema, revokeSeatSchema, type LicenseInput } from "./schema";

const toData = (v: LicenseInput) => ({
  name: v.name,
  vendorId: orNull(v.vendorId),
  type: v.type,
  totalSeats: Number(v.totalSeats),
  purchaseDate: parseOptionalDate(v.purchaseDate),
  expiryDate: parseOptionalDate(v.expiryDate),
  cost: toDecimalOrNull(v.cost),
  subscriptionId: orNull(v.subscriptionId),
  notes: orNull(v.notes),
});

/** Audit snapshots never include the ciphertext. */
const redact = <T extends { licenseKeyEnc?: string | null }>(l: T) => ({ ...l, licenseKeyEnc: l.licenseKeyEnc ? "••• (encrypted)" : null });

export const createLicense = createAction({
  schema: licenseSchema,
  handler: async (input, { tx, audit, user }) => {
    const license = await tx.license.create({ data: { ...toData(input), licenseKeyEnc: input.licenseKey ? encrypt(input.licenseKey) : null } });
    await audit({ action: "CREATE", entityType: "License", entityId: license.id, entityLabel: license.name, after: redact(license) });
    if (input.recordExpense && license.cost && license.purchaseDate) {
      const expense = await tx.expense.create({
        data: {
          date: license.purchaseDate,
          categoryId: await systemCategoryId(tx, "licenses"),
          description: `License · ${license.name} (${license.totalSeats} seat${license.totalSeats === 1 ? "" : "s"})`,
          amount: license.cost,
          taxAmount: 0,
          total: license.cost,
          vendorId: license.vendorId,
          paidBy: user.name,
          source: "LICENSE",
          licenseId: license.id,
          subscriptionId: license.subscriptionId,
        },
      });
      await audit({ action: "CREATE", entityType: "Expense", entityId: expense.id, entityLabel: expense.description, after: expense });
    }
    return { id: license.id };
  },
});

export const updateLicense = createAction({
  schema: licenseUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.license.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("License not found.");
    if (data.type !== "SITE") {
      const used = await tx.licenseSeat.count({ where: { licenseId: id, revokedAt: null } });
      if (Number(data.totalSeats) < used) {
        throw new ActionError(`${used} seats are in use. Revoke some before reducing the total.`, { "data.totalSeats": `At least ${used} (in use)` });
      }
    }
    const licenseKeyEnc = data.clearKey ? null : data.licenseKey ? encrypt(data.licenseKey) : before.licenseKeyEnc;
    const after = await tx.license.update({ where: { id }, data: { ...toData(data), licenseKeyEnc } });
    await audit({ action: "UPDATE", entityType: "License", entityId: id, entityLabel: after.name, before: redact(before), after: redact(after) });
    return { id };
  },
});

export const archiveLicense = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.license.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("License not found.");
    // Archiving ends every active seat as of now; the seat history is kept.
    await tx.licenseSeat.updateMany({ where: { licenseId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    const after = await tx.license.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "License", entityId: id, entityLabel: before.name, before: redact(before), after: redact(after) });
    return { id };
  },
});

export const assignSeat = createAction({
  schema: assignSeatSchema,
  handler: async (v, { tx, audit }) => {
    const license = await tx.license.findFirst({ where: { id: v.licenseId, deletedAt: null } });
    if (!license) throw new ActionError("License not found.");
    if (license.type === "PER_USER" && !v.employeeId) throw new ActionError("Per-user licenses are assigned to employees.", { employeeId: "Choose an employee" });
    if (license.type === "PER_DEVICE" && !v.assetId) throw new ActionError("Per-device licenses are assigned to devices.", { assetId: "Choose a device" });

    // Lock the license row so two simultaneous assigns can't both take the last seat.
    await tx.$queryRaw`SELECT id FROM "License" WHERE id = ${license.id} FOR UPDATE`;
    const active = await tx.licenseSeat.findMany({ where: { licenseId: license.id, revokedAt: null } });
    if (license.type !== "SITE" && active.length >= license.totalSeats) {
      throw new ActionError(`All ${license.totalSeats} seats are in use. Revoke one or increase the seat count.`);
    }
    if (v.employeeId && active.some((s) => s.employeeId === v.employeeId)) throw new ActionError("That employee already has a seat.", { employeeId: "Already has a seat" });
    if (v.assetId && active.some((s) => s.assetId === v.assetId)) throw new ActionError("That device already has a seat.", { assetId: "Already has a seat" });

    if (v.employeeId) {
      const emp = await tx.employee.findFirst({ where: { id: v.employeeId, deletedAt: null } });
      if (!emp || emp.status === "EXITED") throw new ActionError("Choose an active employee.", { employeeId: "Not active" });
    }
    const seat = await tx.licenseSeat.create({
      data: { licenseId: license.id, employeeId: orNull(v.employeeId), assetId: orNull(v.assetId), notes: orNull(v.notes) },
      include: { employee: { select: { name: true } }, asset: { select: { assetTag: true } } },
    });
    await audit({
      action: "CREATE",
      entityType: "LicenseSeat",
      entityId: seat.id,
      entityLabel: `${license.name} → ${seat.employee?.name ?? seat.asset?.assetTag}`,
      after: { ...seat, employee: undefined, asset: undefined },
    });
    return { id: seat.id };
  },
});

export const revokeSeat = createAction({
  schema: revokeSeatSchema,
  handler: async ({ seatId }, { tx, audit }) => {
    const before = await tx.licenseSeat.findUnique({ where: { id: seatId }, include: { license: { select: { name: true } }, employee: { select: { name: true } }, asset: { select: { assetTag: true } } } });
    if (!before || before.revokedAt) throw new ActionError("That seat is already free.");
    const after = await tx.licenseSeat.update({ where: { id: seatId }, data: { revokedAt: new Date() } });
    await audit({
      action: "UPDATE",
      entityType: "LicenseSeat",
      entityId: seatId,
      entityLabel: `${before.license.name} ← ${before.employee?.name ?? before.asset?.assetTag} (revoked)`,
      before: { ...before, license: undefined, employee: undefined, asset: undefined },
      after,
    });
    return { id: seatId };
  },
});

/** Decrypts the stored key for display. Not cached, not logged in plain text. */
export const revealLicenseKey = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx }) => {
    const l = await tx.license.findFirst({ where: { id, deletedAt: null }, select: { licenseKeyEnc: true } });
    if (!l?.licenseKeyEnc) throw new ActionError("No key stored for this license.");
    try {
      return { value: decrypt(l.licenseKeyEnc) };
    } catch {
      throw new ActionError("Couldn't decrypt — was ENCRYPTION_KEY changed?");
    }
  },
});
