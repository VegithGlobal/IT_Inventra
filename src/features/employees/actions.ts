"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { parseDateInput, parseOptionalDate } from "@/lib/dates";
import { storage } from "@/lib/storage";
import { orNull } from "@/lib/validation";
import { deleteEmployeesSchema, EMPLOYEE_CSV_HEADERS, employeeImportSchema, employeeSchema, employeeUpdateSchema, type EmployeeInput } from "./schema";

function toData(v: EmployeeInput) {
  return {
    employeeCode: v.employeeCode.toUpperCase(),
    name: v.name,
    email: orNull(v.email)?.toLowerCase() ?? null,
    phone: orNull(v.phone),
    designation: orNull(v.designation),
    departmentId: orNull(v.departmentId),
    locationId: orNull(v.locationId),
    joiningDate: parseOptionalDate(v.joiningDate),
    exitDate: parseOptionalDate(v.exitDate),
    status: v.status,
    notes: orNull(v.notes),
  };
}

export const createEmployee = createAction({
  schema: employeeSchema,
  handler: async (input, { tx, audit }) => {
    const employee = await tx.employee.create({ data: toData(input) });
    await audit({ action: "CREATE", entityType: "Employee", entityId: employee.id, entityLabel: employee.name, after: employee });
    return { id: employee.id };
  },
});

export const updateEmployee = createAction({
  schema: employeeUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.employee.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Employee not found.");
    const after = await tx.employee.update({ where: { id }, data: toData(data) });
    await audit({ action: "UPDATE", entityType: "Employee", entityId: id, entityLabel: after.name, before, after });
    return { id };
  },
});

export const archiveEmployee = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.employee.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Employee not found.");
    const held = await tx.asset.count({ where: { currentHolderId: id, deletedAt: null } });
    if (held > 0) throw new ActionError(`${before.name} still holds ${held} asset(s). Check them in first.`);
    const seats = await tx.licenseSeat.count({ where: { employeeId: id, revokedAt: null, license: { deletedAt: null } } });
    if (seats > 0) throw new ActionError(`${before.name} still has ${seats} license seat(s). Revoke them first.`);
    const logins = await tx.employeeAccount.count({ where: { employeeId: id, deletedAt: null, status: "ACTIVE" } });
    if (logins > 0) throw new ActionError(`${before.name} still has ${logins} active login(s). Block them and mark them closed first.`);
    const after = await tx.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Employee", entityId: id, entityLabel: before.name, before, after });
    return { id };
  },
});

/**
 * Permanent delete (admin only). Removes the employees with their logins, assignment history,
 * documents and the tickets they raised. Expenses, repairs and stock movements stay (they're real
 * spend) but lose the link. Their name is kept in each asset's "previous users".
 * Same guard as archive: anyone still holding assets, license seats or active logins is refused,
 * so nothing they have goes untracked.
 */
const deleteEmployeesTx = createAction({
  schema: deleteEmployeesSchema,
  roles: ["ADMIN"],
  handler: async ({ ids }, { tx, audit }) => {
    const employees = await tx.employee.findMany({ where: { id: { in: ids } } });
    if (!employees.length) throw new ActionError("Employee not found.");
    const empIds = employees.map((e) => e.id);
    const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? "";
    const refuse = (what: string, holderIds: string[]) => {
      const names = [...new Set(holderIds.map(nameOf))];
      const list = names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");
      throw new ActionError(`${list} still ${names.length === 1 ? "has" : "have"} ${what} first.`);
    };

    const held = await tx.asset.findMany({ where: { currentHolderId: { in: empIds }, deletedAt: null }, select: { currentHolderId: true } });
    if (held.length) refuse("assets assigned. Check them in", held.map((a) => a.currentHolderId!));
    const seats = await tx.licenseSeat.findMany({ where: { employeeId: { in: empIds }, revokedAt: null, license: { deletedAt: null } }, select: { employeeId: true } });
    if (seats.length) refuse("license seats. Revoke them", seats.map((s) => s.employeeId!));
    const logins = await tx.employeeAccount.findMany({ where: { employeeId: { in: empIds }, deletedAt: null, status: "ACTIVE" }, select: { employeeId: true } });
    if (logins.length) refuse("active logins. Block them and mark them closed", logins.map((a) => a.employeeId));

    // Keep their name on the assets they used, so "Previous users" still shows it.
    const used = await tx.assetAssignment.findMany({ where: { employeeId: { in: empIds } }, select: { assetId: true, employeeId: true } });
    for (const assetId of new Set(used.map((u) => u.assetId))) {
      const asset = await tx.asset.findUnique({ where: { id: assetId }, select: { previousUsers: true } });
      if (!asset) continue;
      const names = [...new Set(used.filter((u) => u.assetId === assetId).map((u) => nameOf(u.employeeId)))];
      const add = names.filter((n) => !asset.previousUsers.some((p) => p.toLowerCase() === n.toLowerCase()));
      if (add.length) await tx.asset.update({ where: { id: assetId }, data: { previousUsers: [...add, ...asset.previousUsers] } });
    }

    const ticketIds = (await tx.ticket.findMany({ where: { requesterId: { in: empIds } }, select: { id: true } })).map((t) => t.id);
    const docWhere = { OR: [{ employeeId: { in: empIds } }, { assignment: { employeeId: { in: empIds } } }, { ticketId: { in: ticketIds } }] };
    const fileKeys = [
      ...(await tx.document.findMany({ where: docWhere, select: { fileKey: true } })).map((d) => d.fileKey),
      ...employees.map((e) => e.photoKey).filter((k): k is string => !!k),
    ];

    await tx.document.deleteMany({ where: docWhere });
    await tx.expense.updateMany({ where: { ticketId: { in: ticketIds } }, data: { ticketId: null } });
    await tx.maintenanceRecord.updateMany({ where: { ticketId: { in: ticketIds } }, data: { ticketId: null } });
    await tx.stockMovement.updateMany({ where: { ticketId: { in: ticketIds } }, data: { ticketId: null } });
    await tx.ticketComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await tx.stockMovement.updateMany({ where: { employeeId: { in: empIds } }, data: { employeeId: null } });
    await tx.licenseSeat.deleteMany({ where: { employeeId: { in: empIds }, assetId: null } });
    await tx.licenseSeat.updateMany({ where: { employeeId: { in: empIds } }, data: { employeeId: null } });
    await tx.employeeAccount.deleteMany({ where: { employeeId: { in: empIds } } });
    await tx.assetAssignment.deleteMany({ where: { employeeId: { in: empIds } } });
    await tx.employee.deleteMany({ where: { id: { in: empIds } } });
    for (const before of employees) {
      await audit({ action: "DELETE", entityType: "Employee", entityId: before.id, entityLabel: `${before.name} · ${before.employeeCode} (deleted permanently)`, before });
    }
    return { deleted: employees.length, fileKeys };
  },
});

export async function deleteEmployees(input: { ids: string[] }) {
  const result = await deleteEmployeesTx(input);
  if (!result.ok) return result;
  // Files go only after the rows are gone for good.
  await Promise.allSettled(result.data.fileKeys.map((k) => storage.delete(k)));
  return { ok: true as const, data: { deleted: result.data.deleted } };
}

/** CSV import. Matches department/location by name; skips rows whose employee ID already exists. */
export const importEmployees = createAction({
  schema: employeeImportSchema,
  handler: async ({ rows }, { tx, audit }) => {
    const [header, ...body] = rows;
    const cols = header.map((h) => h.trim().toLowerCase());
    const idx = Object.fromEntries(EMPLOYEE_CSV_HEADERS.map((h) => [h, cols.indexOf(h)]));
    if (idx.employee_id < 0 || idx.name < 0) {
      throw new ActionError("The CSV needs at least the employee_id and name columns. Download the template to see the format.");
    }

    const [departments, locations, existing] = await Promise.all([
      tx.department.findMany({ where: { deletedAt: null } }),
      tx.location.findMany({ where: { deletedAt: null } }),
      tx.employee.findMany({ select: { employeeCode: true, email: true } }),
    ]);
    const codes = new Set(existing.map((e) => e.employeeCode));
    const emails = new Set(existing.map((e) => e.email).filter(Boolean));
    const byName = <T extends { id: string; name: string }>(list: T[], name: string) =>
      list.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())?.id ?? null;

    const errors: string[] = [];
    let created = 0;
    let skipped = 0;
    for (const [i, row] of body.entries()) {
      const get = (key: (typeof EMPLOYEE_CSV_HEADERS)[number]) => (idx[key] >= 0 ? (row[idx[key]] ?? "").trim() : "");
      const line = i + 2;
      const code = get("employee_id").toUpperCase();
      const name = get("name");
      const email = get("email").toLowerCase();
      const joining = get("joining_date");
      if (!code || !name) {
        errors.push(`Row ${line}: employee_id and name are required`);
        continue;
      }
      if (codes.has(code) || (email && emails.has(email))) {
        skipped++;
        continue;
      }
      if (email && !z.email().safeParse(email).success) {
        errors.push(`Row ${line}: invalid email "${email}"`);
        continue;
      }
      if (joining && !/^\d{4}-\d{2}-\d{2}$/.test(joining)) {
        errors.push(`Row ${line}: joining_date must be YYYY-MM-DD`);
        continue;
      }
      const employee = await tx.employee.create({
        data: {
          employeeCode: code,
          name,
          email: email || null,
          phone: get("phone") || null,
          designation: get("designation") || null,
          departmentId: get("department") ? byName(departments, get("department")) : null,
          locationId: get("location") ? byName(locations, get("location")) : null,
          joiningDate: joining ? parseDateInput(joining) : null,
        },
      });
      await audit({ action: "CREATE", entityType: "Employee", entityId: employee.id, entityLabel: `${employee.name} (CSV import)`, after: employee });
      codes.add(code);
      if (email) emails.add(email);
      created++;
    }
    return { created, skipped, errors: errors.slice(0, 20) };
  },
});
