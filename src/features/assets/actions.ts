"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { AssetCondition } from "@/generated/prisma/enums";
import { ActionError, createAction } from "@/lib/action";
import type { Tx } from "@/lib/db";
import { parseDateInput, parseOptionalDate } from "@/lib/dates";
import { toDecimalOrNull } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { systemCategoryId } from "@/features/expenses/system";
import { ASSET_CSV_HEADERS, assetImportSchema, assetSchema, assetUpdateSchema, bulkStatusSchema, type AssetInput } from "./schema";

/** Next tag for a type, e.g. LAP-0013. Row-locked inside the transaction. */
async function nextTag(tx: Tx, typeId: string) {
  const type = await tx.assetType.update({ where: { id: typeId }, data: { nextSequence: { increment: 1 } } });
  return `${type.prefix}-${String(type.nextSequence - 1).padStart(4, "0")}`;
}

function specsOf(v: Pick<AssetInput, "cpu" | "ram" | "storage" | "os">) {
  const specs = Object.fromEntries(Object.entries({ cpu: v.cpu, ram: v.ram, storage: v.storage, os: v.os }).filter(([, val]) => val));
  return Object.keys(specs).length ? (specs as Prisma.InputJsonObject) : undefined;
}

function toData(v: AssetInput) {
  return {
    name: v.name,
    typeId: v.typeId,
    brand: orNull(v.brand),
    model: orNull(v.model),
    serialNumber: orNull(v.serialNumber),
    purchaseDate: parseOptionalDate(v.purchaseDate),
    purchaseCost: toDecimalOrNull(v.purchaseCost),
    vendorId: orNull(v.vendorId),
    invoiceNumber: orNull(v.invoiceNumber),
    warrantyStart: parseOptionalDate(v.warrantyStart),
    warrantyEnd: parseOptionalDate(v.warrantyEnd),
    locationId: orNull(v.locationId),
    departmentId: orNull(v.departmentId),
    condition: v.condition,
    notes: orNull(v.notes),
  };
}

async function recordPurchase(tx: Tx, asset: { id: string; assetTag: string; name: string; purchaseDate: Date | null; purchaseCost: Prisma.Decimal | null; vendorId: string | null; invoiceNumber: string | null }) {
  if (!asset.purchaseCost || !asset.purchaseDate) return null;
  return tx.expense.create({
    data: {
      date: asset.purchaseDate,
      categoryId: await systemCategoryId(tx, "hardware"),
      description: `Purchase · ${asset.assetTag} ${asset.name}`,
      amount: asset.purchaseCost,
      taxAmount: 0,
      total: asset.purchaseCost,
      vendorId: asset.vendorId,
      transactionRef: asset.invoiceNumber,
      source: "ASSET_PURCHASE",
      assetId: asset.id,
    },
  });
}

export const createAsset = createAction({
  schema: assetSchema,
  handler: async (input, { tx, audit }) => {
    if (input.status === "ASSIGNED") throw new ActionError("Create the asset first, then assign it to someone.");
    const asset = await tx.asset.create({
      data: { ...toData(input), specs: specsOf(input), status: input.status, assetTag: await nextTag(tx, input.typeId) },
    });
    await audit({ action: "CREATE", entityType: "Asset", entityId: asset.id, entityLabel: `${asset.assetTag} · ${asset.name}`, after: asset });
    if (input.recordExpense) {
      const expense = await recordPurchase(tx, asset);
      if (expense) await audit({ action: "CREATE", entityType: "Expense", entityId: expense.id, entityLabel: expense.description, after: expense });
    }
    return { id: asset.id, assetTag: asset.assetTag };
  },
});

export const updateAsset = createAction({
  schema: assetUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.asset.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Asset not found.");
    if (before.typeId !== data.typeId) throw new ActionError("The type can't change after the tag is issued. Archive and re-create instead.");
    // ASSIGNED ↔ other statuses only change through check-out / check-in.
    if ((before.status === "ASSIGNED") !== (data.status === "ASSIGNED")) {
      throw new ActionError(before.status === "ASSIGNED" ? "Check the asset in before changing its status." : "Use Assign to check the asset out.", {
        "data.status": "Use check-out / check-in",
      });
    }
    const after = await tx.asset.update({ where: { id }, data: { ...toData(data), specs: specsOf(data) ?? Prisma.DbNull, status: data.status } });
    await audit({ action: "UPDATE", entityType: "Asset", entityId: id, entityLabel: after.assetTag, before, after });
    return { id };
  },
});

export const archiveAsset = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.asset.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Asset not found.");
    if (before.status === "ASSIGNED") throw new ActionError("Check the asset in before archiving it.");
    const after = await tx.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Asset", entityId: id, entityLabel: before.assetTag, before, after });
    return { id };
  },
});

export const bulkSetStatus = createAction({
  schema: bulkStatusSchema,
  handler: async ({ ids, status }, { tx, audit }) => {
    const assets = await tx.asset.findMany({ where: { id: { in: ids }, deletedAt: null } });
    let updated = 0;
    let skipped = 0;
    for (const before of assets) {
      if (before.status === "ASSIGNED" || before.status === status) {
        skipped++;
        continue;
      }
      const after = await tx.asset.update({ where: { id: before.id }, data: { status } });
      await audit({ action: "UPDATE", entityType: "Asset", entityId: before.id, entityLabel: before.assetTag, before, after });
      updated++;
    }
    return { updated, skipped };
  },
});

const CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR"] as const;

/** CSV import. Type matched by name or prefix; vendor/location by name. Duplicate serials are skipped. */
export const importAssets = createAction({
  schema: assetImportSchema,
  handler: async ({ rows }, { tx, audit }) => {
    const [header, ...body] = rows;
    const cols = header.map((h) => h.trim().toLowerCase());
    const idx = Object.fromEntries(ASSET_CSV_HEADERS.map((h) => [h, cols.indexOf(h)]));
    if (idx.name < 0 || idx.type < 0) throw new ActionError("The CSV needs at least the name and type columns. Download the template to see the format.");

    const [types, vendors, locations, serials] = await Promise.all([
      tx.assetType.findMany(),
      tx.vendor.findMany({ where: { deletedAt: null } }),
      tx.location.findMany({ where: { deletedAt: null } }),
      tx.asset.findMany({ where: { serialNumber: { not: null } }, select: { serialNumber: true } }),
    ]);
    const seen = new Set(serials.map((s) => s.serialNumber!.toLowerCase()));
    const findName = <T extends { id: string; name: string }>(list: T[], v: string) => list.find((x) => x.name.toLowerCase() === v.toLowerCase())?.id ?? null;
    const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? parseDateInput(v) : null);

    const errors: string[] = [];
    let created = 0;
    let skipped = 0;
    for (const [i, row] of body.entries()) {
      const get = (k: (typeof ASSET_CSV_HEADERS)[number]) => (idx[k] >= 0 ? (row[idx[k]] ?? "").trim() : "");
      const line = i + 2;
      const typeName = get("type").toLowerCase();
      const type = types.find((t) => t.name.toLowerCase() === typeName || t.prefix.toLowerCase() === typeName);
      if (!get("name") || !type) {
        errors.push(`Row ${line}: ${!get("name") ? "name is required" : `unknown type "${get("type")}"`}`);
        continue;
      }
      const serial = get("serial_number");
      if (serial && seen.has(serial.toLowerCase())) {
        skipped++;
        continue;
      }
      const cost = get("purchase_cost").replace(/[₹,\s]/g, "");
      if (cost && !/^\d+(\.\d{1,2})?$/.test(cost)) {
        errors.push(`Row ${line}: purchase_cost "${get("purchase_cost")}" isn't a number`);
        continue;
      }
      for (const k of ["purchase_date", "warranty_end"] as const) {
        if (get(k) && !date(get(k))) errors.push(`Row ${line}: ${k} must be YYYY-MM-DD (ignored)`);
      }
      const condition = get("condition").toUpperCase();
      const asset = await tx.asset.create({
        data: {
          assetTag: await nextTag(tx, type.id),
          name: get("name"),
          typeId: type.id,
          brand: get("brand") || null,
          model: get("model") || null,
          serialNumber: serial || null,
          purchaseDate: date(get("purchase_date")),
          purchaseCost: toDecimalOrNull(cost),
          vendorId: get("vendor") ? findName(vendors, get("vendor")) : null,
          invoiceNumber: get("invoice_number") || null,
          warrantyStart: date(get("purchase_date")),
          warrantyEnd: date(get("warranty_end")),
          locationId: get("location") ? findName(locations, get("location")) : null,
          condition: (CONDITIONS as readonly string[]).includes(condition) ? (condition as AssetCondition) : "GOOD",
          notes: get("notes") || null,
        },
      });
      await audit({ action: "CREATE", entityType: "Asset", entityId: asset.id, entityLabel: `${asset.assetTag} · ${asset.name} (CSV import)`, after: asset });
      if (serial) seen.add(serial.toLowerCase());
      created++;
    }
    return { created, skipped, errors: errors.slice(0, 20) };
  },
});
