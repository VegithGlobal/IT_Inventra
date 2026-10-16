"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { parseDateInput, parseOptionalDate } from "@/lib/dates";
import { orNull } from "@/lib/validation";
import { EMPLOYEE_CSV_HEADERS, employeeImportSchema, employeeSchema, employeeUpdateSchema, type EmployeeInput } from "./schema";

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
    const after = await tx.employee.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Employee", entityId: id, entityLabel: before.name, before, after });
    return { id };
  },
});

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
