"use server";

import { Prisma } from "@/generated/prisma/client";
import { ActionError, createAction } from "@/lib/action";
import { orNull } from "@/lib/validation";
import { assetTypeSchema, departmentSchema, idOnly, locationSchema, withId, type AssetTypeInput, type LocationInput } from "./schema";

// ─── Departments ──────────────────────────────────────────────────────────────

export const saveDepartment = createAction({
  schema: withId(departmentSchema).partial({ id: true }),
  handler: async ({ id, data }, { tx, audit }) => {
    const values = { name: data.name, code: orNull(data.code) };
    if (!id) {
      const created = await tx.department.create({ data: values });
      await audit({ action: "CREATE", entityType: "Department", entityId: created.id, entityLabel: created.name, after: created });
      return { id: created.id };
    }
    const before = await tx.department.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Department not found.");
    const after = await tx.department.update({ where: { id }, data: values });
    await audit({ action: "UPDATE", entityType: "Department", entityId: id, entityLabel: after.name, before, after });
    return { id };
  },
});

export const archiveDepartment = createAction({
  schema: idOnly,
  roles: ["ADMIN"],
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.department.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Department not found.");
    const used = await tx.employee.count({ where: { departmentId: id, deletedAt: null, status: { not: "EXITED" } } });
    if (used) throw new ActionError(`${used} active employee(s) are in this department. Move them first.`);
    // Free the unique name so it can be reused.
    const after = await tx.department.update({ where: { id }, data: { deletedAt: new Date(), name: `${before.name} (archived ${Date.now()})` } });
    await audit({ action: "DELETE", entityType: "Department", entityId: id, entityLabel: before.name, before, after });
    return { id };
  },
});

// ─── Locations ────────────────────────────────────────────────────────────────

const locationData = (v: LocationInput) => ({ name: v.name, city: orNull(v.city), address: orNull(v.address), notes: orNull(v.notes) });

export const saveLocation = createAction({
  schema: withId(locationSchema).partial({ id: true }),
  handler: async ({ id, data }, { tx, audit }) => {
    if (!id) {
      const created = await tx.location.create({ data: locationData(data) });
      await audit({ action: "CREATE", entityType: "Location", entityId: created.id, entityLabel: created.name, after: created });
      return { id: created.id };
    }
    const before = await tx.location.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Location not found.");
    const after = await tx.location.update({ where: { id }, data: locationData(data) });
    await audit({ action: "UPDATE", entityType: "Location", entityId: id, entityLabel: after.name, before, after });
    return { id };
  },
});

export const archiveLocation = createAction({
  schema: idOnly,
  roles: ["ADMIN"],
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.location.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Location not found.");
    const assets = await tx.asset.count({ where: { locationId: id, deletedAt: null } });
    if (assets) throw new ActionError(`${assets} asset(s) are at this location. Move them first.`);
    const after = await tx.location.update({ where: { id }, data: { deletedAt: new Date(), name: `${before.name} (archived ${Date.now()})` } });
    await audit({ action: "DELETE", entityType: "Location", entityId: id, entityLabel: before.name, before, after });
    return { id };
  },
});

// ─── Asset types ──────────────────────────────────────────────────────────────

const typeData = (v: AssetTypeInput) => ({
  name: v.name,
  prefix: v.prefix,
  usefulLifeMonths: Number(v.usefulLifeMonths),
  salvagePercent: new Prisma.Decimal(v.salvagePercent),
});

export const saveAssetType = createAction({
  schema: withId(assetTypeSchema).partial({ id: true }),
  roles: ["ADMIN"],
  handler: async ({ id, data }, { tx, audit }) => {
    if (!id) {
      const max = await tx.assetType.aggregate({ _max: { sortOrder: true } });
      const created = await tx.assetType.create({ data: { ...typeData(data), sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await audit({ action: "CREATE", entityType: "AssetType", entityId: created.id, entityLabel: created.name, after: created });
      return { id: created.id };
    }
    const before = await tx.assetType.findUnique({ where: { id } });
    if (!before) throw new ActionError("Asset type not found.");
    if (before.prefix !== data.prefix && (await tx.asset.count({ where: { typeId: id } })) > 0) {
      throw new ActionError("The prefix can't change once assets use it — existing tags would no longer match.", {
        "data.prefix": "Prefix is locked: assets already use it",
      });
    }
    const after = await tx.assetType.update({ where: { id }, data: typeData(data) });
    await audit({ action: "UPDATE", entityType: "AssetType", entityId: id, entityLabel: after.name, before, after });
    return { id };
  },
});
