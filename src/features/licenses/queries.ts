import "server-only";
import { db } from "@/lib/db";
import { daysBetween, toDateInput, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { LicenseInput } from "./schema";

export async function listLicenses() {
  const t = today();
  const rows = await db.license.findMany({
    where: { deletedAt: null },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    include: {
      vendor: { select: { name: true } },
      subscription: { select: { id: true, name: true } },
      _count: { select: { seats: { where: { revokedAt: null } } } },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    vendor: l.vendor?.name ?? null,
    type: l.type,
    totalSeats: l.totalSeats,
    usedSeats: l._count.seats,
    purchaseDate: l.purchaseDate,
    expiryDate: l.expiryDate,
    daysToExpiry: l.expiryDate ? daysBetween(t, l.expiryDate) : null,
    cost: l.cost === null ? null : toNumber(l.cost),
    subscription: l.subscription,
    hasKey: !!l.licenseKeyEnc,
  }));
}
export type LicenseRow = Awaited<ReturnType<typeof listLicenses>>[number];

export async function getLicense(id: string) {
  const license = await db.license.findFirst({
    where: { id, deletedAt: null },
    include: {
      vendor: true,
      subscription: { select: { id: true, name: true, nextDueDate: true } },
      seats: {
        orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { assignedAt: "desc" }],
        include: {
          employee: { select: { id: true, name: true, status: true, department: { select: { name: true } } } },
          asset: { select: { id: true, assetTag: true, name: true, currentHolder: { select: { name: true } } } },
        },
      },
    },
  });
  if (!license) return null;
  const activity = await db.auditLog.findMany({
    where: { OR: [{ entityType: "License", entityId: id }, { entityType: "LicenseSeat", entityId: { in: license.seats.map((s) => s.id) } }] },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { license, activity };
}

type FullLicense = NonNullable<Awaited<ReturnType<typeof getLicense>>>["license"];

export function licenseFormValues(l: FullLicense): LicenseInput {
  return {
    name: l.name,
    vendorId: l.vendorId ?? "",
    type: l.type,
    totalSeats: String(l.totalSeats),
    purchaseDate: toDateInput(l.purchaseDate),
    expiryDate: toDateInput(l.expiryDate),
    cost: l.cost?.toString() ?? "",
    subscriptionId: l.subscriptionId ?? "",
    licenseKey: "",
    clearKey: false,
    notes: l.notes ?? "",
    recordExpense: false,
  };
}

export async function getLicenseLookups() {
  const [vendors, subscriptions, employees, assets] = await Promise.all([
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.subscription.findMany({ where: { deletedAt: null, status: { not: "CANCELLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ where: { deletedAt: null, status: { not: "EXITED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.asset.findMany({
      where: { deletedAt: null, status: { notIn: ["DISPOSED", "RETIRED", "LOST_STOLEN"] } },
      orderBy: { assetTag: "asc" },
      select: { id: true, assetTag: true, name: true },
    }),
  ]);
  return {
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    subscriptions: subscriptions.map((s) => ({ value: s.id, label: s.name })),
    employees: employees.map((e) => ({ value: e.id, label: e.name })),
    assets: assets.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}` })),
  };
}
export type LicenseLookups = Awaited<ReturnType<typeof getLicenseLookups>>;
