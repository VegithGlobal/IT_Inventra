import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

/** Company code = the letters an employee ID starts with (VG019 → VG, MLPL005 → MLPL, TMP-0009 → TMP). */
export function companyCodeOf(employeeCode: string) {
  return employeeCode.match(/^[A-Za-z]+/)?.[0].toUpperCase() ?? "—";
}

export async function listEmployees() {
  const rows = await db.employee.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      department: { select: { name: true } },
      location: { select: { name: true } },
      heldAssets: { where: { deletedAt: null }, select: { purchaseCost: true } },
      _count: {
        select: {
          licenseSeats: { where: { revokedAt: null, license: { deletedAt: null } } },
          accounts: { where: { deletedAt: null, status: "ACTIVE" } },
        },
      },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    companyCode: companyCodeOf(e.employeeCode),
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
    archivedAt: e.archivedAt,
    exitDate: e.exitDate,
    /** What's still to collect before they can be deleted. */
    pending: { assets: e.heldAssets.length, seats: e._count.licenseSeats, logins: e._count.accounts },
  })).sort(
    // Grouped by company, then by ID in numeric order (VG19 before VG100).
    (a, b) => a.companyCode.localeCompare(b.companyCode) || a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true }),
  );
}
export type EmployeeRow = Awaited<ReturnType<typeof listEmployees>>[number];

/** Lightweight lists for selects across modules. */
export async function getLookups() {
  const [departments, locations, vendors, employees, assetTypes] = await Promise.all([
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
    db.employee.findMany({
      where: { deletedAt: null, archivedAt: null },
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
      // An asset transferred away belongs to its new holder only — the full
      // chain stays on the asset's own page. (transferAsset closes the old
      // assignment with returnNotes "Transferred"; null kept explicitly
      // because SQL `<>` drops NULL rows, i.e. every open assignment.)
      assignments: {
        where: { OR: [{ returnNotes: null }, { returnNotes: { not: "Transferred" } }] },
        include: { asset: { include: { type: true } } },
        orderBy: { issuedAt: "desc" },
      },
      tickets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, include: { category: true } },
      licenseSeats: { where: { revokedAt: null, license: { deletedAt: null } }, include: { license: { select: { id: true, name: true, type: true, expiryDate: true } } }, orderBy: { assignedAt: "desc" } },
      accounts: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { system: { name: "asc" } }],
        include: { system: { select: { id: true, name: true, category: true, offboardingSteps: true } } },
      },
      stockMovements: { where: { type: "STOCK_OUT" }, include: { item: { select: { id: true, name: true, unit: true } } }, orderBy: { occurredAt: "desc" }, take: 30 },
    },
  });
}
