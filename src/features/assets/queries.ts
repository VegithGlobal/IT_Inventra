import "server-only";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import { bookValue } from "@/lib/depreciation";
import { toNumber } from "@/lib/format";
import type { AssetInput } from "./schema";

export async function listAssets() {
  const assets = await db.asset.findMany({
    where: { deletedAt: null },
    orderBy: { assetTag: "asc" },
    include: {
      type: true,
      currentHolder: { select: { id: true, name: true } },
      location: { select: { name: true } },
      department: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });
  return assets.map((a) => ({
    id: a.id,
    assetTag: a.assetTag,
    name: a.name,
    type: a.type.name,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serialNumber,
    status: a.status,
    condition: a.condition,
    holder: a.currentHolder?.name ?? null,
    holderId: a.currentHolder?.id ?? null,
    location: a.location?.name ?? null,
    department: a.department?.name ?? null,
    vendor: a.vendor?.name ?? null,
    purchaseDate: a.purchaseDate,
    purchaseCost: a.purchaseCost ? toNumber(a.purchaseCost) : null,
    warrantyEnd: a.warrantyEnd,
    bookValue: bookValue({
      cost: a.purchaseCost,
      purchaseDate: a.purchaseDate,
      usefulLifeMonths: a.type.usefulLifeMonths,
      salvagePercent: a.type.salvagePercent,
    }).bookValue,
  }));
}
export type AssetRow = Awaited<ReturnType<typeof listAssets>>[number];

export async function getAsset(id: string) {
  const asset = await db.asset.findFirst({
    where: { id, deletedAt: null },
    include: {
      type: true,
      vendor: true,
      location: true,
      department: true,
      currentHolder: true,
      assignments: { include: { employee: true, issuedBy: { select: { name: true } }, receivedBy: { select: { name: true } } }, orderBy: { issuedAt: "desc" } },
      maintenance: { where: { deletedAt: null }, include: { vendor: true }, orderBy: { sentAt: "desc" } },
      tickets: { where: { deletedAt: null }, include: { requester: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!asset) return null;
  const activity = await db.auditLog.findMany({
    where: { entityType: "Asset", entityId: id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const depreciation = bookValue({
    cost: asset.purchaseCost,
    purchaseDate: asset.purchaseDate,
    usefulLifeMonths: asset.type.usefulLifeMonths,
    salvagePercent: asset.type.salvagePercent,
  });
  return { asset, activity, depreciation };
}

type FullAsset = NonNullable<Awaited<ReturnType<typeof getAsset>>>["asset"];

export function assetFormValues(a: FullAsset): AssetInput {
  const specs = (a.specs ?? {}) as Record<string, string>;
  return {
    name: a.name,
    typeId: a.typeId,
    brand: a.brand ?? "",
    model: a.model ?? "",
    serialNumber: a.serialNumber ?? "",
    cpu: specs.cpu ?? "",
    ram: specs.ram ?? "",
    storage: specs.storage ?? "",
    os: specs.os ?? "",
    purchaseDate: toDateInput(a.purchaseDate),
    purchaseCost: a.purchaseCost?.toString() ?? "",
    vendorId: a.vendorId ?? "",
    invoiceNumber: a.invoiceNumber ?? "",
    warrantyStart: toDateInput(a.warrantyStart),
    warrantyEnd: toDateInput(a.warrantyEnd),
    locationId: a.locationId ?? "",
    departmentId: a.departmentId ?? "",
    condition: a.condition,
    status: a.status,
    notes: a.notes ?? "",
    recordExpense: false,
  };
}
