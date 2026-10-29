import "server-only";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import type { AccountInput, SystemInput } from "./schema";

const employeeSelect = { id: true, name: true, employeeCode: true, status: true, exitDate: true, department: { select: { name: true } } } as const;

export async function listAccounts() {
  const rows = await db.employeeAccount.findMany({
    where: { deletedAt: null, employee: { deletedAt: null } },
    orderBy: [{ employee: { name: "asc" } }, { system: { name: "asc" } }],
    include: { employee: { select: employeeSelect }, system: { select: { id: true, name: true, category: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    employeeId: a.employee.id,
    employee: a.employee.name,
    employeeCode: a.employee.employeeCode,
    employeeStatus: a.employee.status,
    department: a.employee.department?.name ?? null,
    systemId: a.system.id,
    system: a.system.name,
    category: a.system.category,
    username: a.username,
    accessLevel: a.accessLevel,
    mfaEnabled: a.mfaEnabled,
    personal: a.personal,
    grantedAt: a.grantedAt,
    status: a.status,
    closedAt: a.closedAt,
    hasPassword: !!a.passwordEnc,
  }));
}
export type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number];

/** Leaving/exited employees who still have active logins — the offboarding to-do list. */
export async function listOpenLeavers() {
  const rows = await db.employee.findMany({
    where: { deletedAt: null, status: { not: "ACTIVE" }, accounts: { some: { deletedAt: null, status: "ACTIVE" } } },
    orderBy: [{ exitDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: { ...employeeSelect, _count: { select: { accounts: { where: { deletedAt: null, status: "ACTIVE" } } } } },
  });
  return rows.map((e) => ({ id: e.id, name: e.name, status: e.status, exitDate: e.exitDate, open: e._count.accounts }));
}
export type OpenLeaver = Awaited<ReturnType<typeof listOpenLeavers>>[number];

export async function getAccount(id: string) {
  const account = await db.employeeAccount.findFirst({
    where: { id, deletedAt: null },
    include: { employee: { select: employeeSelect }, system: { include: { vendor: { select: { id: true, name: true } } } }, closedBy: { select: { name: true } } },
  });
  if (!account) return null;
  const activity = await db.auditLog.findMany({
    where: { entityType: "EmployeeAccount", entityId: id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { account, activity };
}

export function accountFormValues(a: { employeeId: string; systemId: string; username: string; accessLevel: string | null; mfaEnabled: boolean; personal: boolean; grantedAt: Date | null; notes: string | null }): AccountInput {
  return {
    employeeId: a.employeeId,
    systemId: a.systemId,
    username: a.username,
    accessLevel: a.accessLevel ?? "",
    mfaEnabled: a.mfaEnabled,
    personal: a.personal,
    grantedAt: toDateInput(a.grantedAt),
    password: "",
    clearPassword: false,
    notes: a.notes ?? "",
  };
}

export async function listSystems() {
  const rows = await db.appSystem.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      vendor: { select: { name: true } },
      accounts: { where: { deletedAt: null, employee: { deletedAt: null } }, select: { status: true, mfaEnabled: true, employee: { select: { status: true } } } },
    },
  });
  return rows.map((s) => {
    const active = s.accounts.filter((a) => a.status === "ACTIVE");
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      vendor: s.vendor?.name ?? null,
      loginUrl: s.loginUrl,
      active: active.length,
      total: s.accounts.length,
      noMfa: active.filter((a) => !a.mfaEnabled).length,
      leavers: active.filter((a) => a.employee.status !== "ACTIVE").length,
    };
  });
}
export type SystemRow = Awaited<ReturnType<typeof listSystems>>[number];

export async function getSystem(id: string) {
  const system = await db.appSystem.findFirst({
    where: { id, deletedAt: null },
    include: {
      vendor: { select: { id: true, name: true } },
      accounts: {
        where: { deletedAt: null, employee: { deletedAt: null } },
        orderBy: [{ status: "asc" }, { employee: { name: "asc" } }],
        include: { employee: { select: employeeSelect } },
      },
    },
  });
  if (!system) return null;
  const activity = await db.auditLog.findMany({
    where: { entityType: "AppSystem", entityId: id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return { system, activity };
}

export function systemFormValues(s: { name: string; category: SystemInput["category"]; loginUrl: string | null; vendorId: string | null; offboardingSteps: string | null; notes: string | null }): SystemInput {
  return {
    name: s.name,
    category: s.category,
    loginUrl: s.loginUrl ?? "",
    vendorId: s.vendorId ?? "",
    offboardingSteps: s.offboardingSteps ?? "",
    notes: s.notes ?? "",
  };
}

export async function getAccountLookups() {
  const [employees, systems, vendors] = await Promise.all([
    db.employee.findMany({ where: { deletedAt: null, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, employeeCode: true, status: true } }),
    db.appSystem.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    employees: employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})${e.status === "ACTIVE" ? "" : e.status === "LEAVING" ? " · leaving" : " · exited"}` })),
    systems: systems.map((s) => ({ value: s.id, label: s.name })),
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
  };
}
export type AccountLookups = Awaited<ReturnType<typeof getAccountLookups>>;

/** Everything an employee must hand back or lose access to, for the printable checklist. */
export async function getOffboardingChecklist(employeeId: string) {
  return db.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: {
      department: { select: { name: true } },
      location: { select: { name: true } },
      assignments: { where: { returnedAt: null }, include: { asset: { select: { assetTag: true, name: true, serialNumber: true } } }, orderBy: { issuedAt: "asc" } },
      licenseSeats: { where: { revokedAt: null, license: { deletedAt: null } }, include: { license: { select: { name: true } } } },
      accounts: {
        where: { deletedAt: null },
        orderBy: [{ system: { name: "asc" } }],
        include: { system: { select: { name: true, category: true, offboardingSteps: true, loginUrl: true } }, closedBy: { select: { name: true } } },
      },
    },
  });
}
