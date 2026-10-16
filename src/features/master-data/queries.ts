import "server-only";
import { db } from "@/lib/db";

export async function listDepartments() {
  const rows = await db.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { employees: { where: { deletedAt: null, status: { not: "EXITED" } } }, assets: { where: { deletedAt: null } } },
      },
    },
  });
  return rows.map((d) => ({ id: d.id, name: d.name, code: d.code ?? "", employees: d._count.employees, assets: d._count.assets }));
}
export type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];

export async function listLocations() {
  const rows = await db.location.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { employees: { where: { deletedAt: null, status: { not: "EXITED" } } }, assets: { where: { deletedAt: null } } },
      },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    city: l.city ?? "",
    address: l.address ?? "",
    notes: l.notes ?? "",
    employees: l._count.employees,
    assets: l._count.assets,
  }));
}
export type LocationRow = Awaited<ReturnType<typeof listLocations>>[number];

export async function listAssetTypes() {
  const rows = await db.assetType.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    prefix: t.prefix,
    nextSequence: t.nextSequence,
    usefulLifeMonths: String(t.usefulLifeMonths),
    salvagePercent: t.salvagePercent.toString(),
    assets: t._count.assets,
  }));
}
export type AssetTypeRow = Awaited<ReturnType<typeof listAssetTypes>>[number];
