"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { orNull } from "@/lib/validation";
import { vendorSchema, vendorUpdateSchema, type VendorInput } from "./schema";

const toData = (v: VendorInput) => ({
  name: v.name,
  category: v.category,
  contactPerson: orNull(v.contactPerson),
  phone: orNull(v.phone),
  email: orNull(v.email)?.toLowerCase() ?? null,
  address: orNull(v.address),
  gstin: orNull(v.gstin),
  website: orNull(v.website),
  notes: orNull(v.notes),
});

export const createVendor = createAction({
  schema: vendorSchema,
  handler: async (input, { tx, audit }) => {
    const vendor = await tx.vendor.create({ data: toData(input) });
    await audit({ action: "CREATE", entityType: "Vendor", entityId: vendor.id, entityLabel: vendor.name, after: vendor });
    return { id: vendor.id };
  },
});

export const updateVendor = createAction({
  schema: vendorUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.vendor.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Vendor not found.");
    const after = await tx.vendor.update({ where: { id }, data: toData(data) });
    await audit({ action: "UPDATE", entityType: "Vendor", entityId: id, entityLabel: after.name, before, after });
    return { id };
  },
});

/** Soft delete. Historical assets/expenses keep pointing at the archived vendor. */
export const archiveVendor = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.vendor.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Vendor not found.");
    const activeSubs = await tx.subscription.count({ where: { vendorId: id, deletedAt: null, status: "ACTIVE" } });
    if (activeSubs) throw new ActionError(`This vendor has ${activeSubs} active subscription(s). Cancel or move them first.`);
    const after = await tx.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Vendor", entityId: id, entityLabel: before.name, before, after });
    return { id };
  },
});
