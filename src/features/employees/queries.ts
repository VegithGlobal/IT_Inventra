import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

export async function listEmployees() {
  const rows = await db.employee.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      department: { select: { name: true } },
      location: { select: { name: true } },
      heldAssets: { where: { deletedAt: null }, select: { purchaseCost: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    name: e.name,
    email: e.email,
    phone: e.phone,
    designation: e.designation,
    department: e.department?.name ?? null,
    location: e.location?.name ?? null,
    status: e.status,
    joiningDate: e.joiningDate,
    assetCount: e.heldAssets.length,
    assetValue: e.heldAssets.reduce((s, a) => s + toNumber(a.purchaseCost), 0),
  }));
}
export type EmployeeRow = Awaited<ReturnType<typeof listEmployees>>[number];

/** Lightweight lists for selects across modules. */
export async function getLookups() {
  const [departments, locations, vendors, employees, assetTypes] = await Promise.all([
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
    db.employee.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true, status: true, departmentId: true, locationId: true },
    }),
    db.assetType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, prefix: true } }),
  ]);
  return { departments, locations, vendors, employees, assetTypes };
}
export type Lookups = Awaited<ReturnType<typeof getLookups>>;

export async function getEmployee(id: string) {
  return db.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      department: true,
      location: true,
      heldAssets: { where: { deletedAt: null }, include: { type: true }, orderBy: { assetTag: "asc" } },
      assignments: { include: { asset: { include: { type: true } } }, orderBy: { issuedAt: "desc" } },
      tickets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, include: { category: true } },
      licenseSeats: { where: { revokedAt: null, license: { deletedAt: null } }, include: { license: { select: { id: true, name: true, type: true, expiryDate: true } } }, orderBy: { assignedAt: "desc" } },
      stockMovements: { where: { type: "STOCK_OUT" }, include: { item: { select: { id: true, name: true, unit: true } } }, orderBy: { occurredAt: "desc" }, take: 30 },
    },
  });
}
