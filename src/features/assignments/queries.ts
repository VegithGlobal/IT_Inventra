import "server-only";
import { db } from "@/lib/db";
import { daysBetween, today } from "@/lib/dates";

export async function listAssignments() {
  const rows = await db.assetAssignment.findMany({
    where: { asset: { deletedAt: null } },
    orderBy: [{ returnedAt: { sort: "desc", nulls: "first" } }, { issuedAt: "desc" }],
    include: {
      asset: { select: { id: true, assetTag: true, name: true, type: { select: { name: true } } } },
      employee: { select: { id: true, name: true, status: true, department: { select: { name: true } } } },
    },
  });
  const t = today();
  return rows.map((a) => ({
    id: a.id,
    assetId: a.asset.id,
    assetTag: a.asset.assetTag,
    assetName: a.asset.name,
    assetType: a.asset.type.name,
    employeeId: a.employee.id,
    employee: a.employee.name,
    employeeStatus: a.employee.status,
    department: a.employee.department?.name ?? null,
    issuedAt: a.issuedAt,
    expectedReturnAt: a.expectedReturnAt,
    returnedAt: a.returnedAt,
    state: a.returnedAt ? ("RETURNED" as const) : a.expectedReturnAt && a.expectedReturnAt < t ? ("OVERDUE" as const) : ("ACTIVE" as const),
    days: daysBetween(a.issuedAt, a.returnedAt ?? t),
    conditionAtIssue: a.conditionAtIssue,
    conditionAtReturn: a.conditionAtReturn,
  }));
}
export type AssignmentRow = Awaited<ReturnType<typeof listAssignments>>[number];

/** Pickers for the assign dialog. */
export async function getAssignOptions() {
  const [assets, employees] = await Promise.all([
    db.asset.findMany({
      where: { deletedAt: null, status: { in: ["IN_STOCK", "IN_TRANSIT", "UNDER_REPAIR"] } },
      orderBy: { assetTag: "asc" },
      select: { id: true, assetTag: true, name: true, condition: true, status: true },
    }),
    db.employee.findMany({
      where: { deletedAt: null, status: { not: "EXITED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
    }),
  ]);
  return { assets, employees };
}
export type AssignOptions = Awaited<ReturnType<typeof getAssignOptions>>;

export async function getAssignmentForPrint(id: string) {
  return db.assetAssignment.findUnique({
    where: { id },
    include: {
      asset: { include: { type: true } },
      employee: { include: { department: true, location: true } },
      issuedBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
    },
  });
}
