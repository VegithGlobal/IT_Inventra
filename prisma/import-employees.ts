// One-off import of "LIST OF EMPLOYEE IT.xlsx" (exported to legacy/employees-list.json).
// People already created as TMP-xxxx placeholders by the asset import are updated in place (so their
// assets stay linked); everyone else is created. Safe to re-run: existing employee IDs are updated, not duplicated.
// Needs legacy/employee-placeholders.json (sheet employee ID → TMP code). Data files stay local (git-ignored).
// Run: npx tsx prisma/import-employees.ts [path/to/employees-list.json] [--dry-run]

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Row = { row: number; company: string; code: string; name: string; department: string; designation: string; location: string; phone: string; userType: string };

const LOCATION_ALIASES: Record<string, string> = { "jsw site": "JSW", "jsw site/ bhiwandi": "JSW" };

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--")) ?? "legacy/employees-list.json";
  const rows = JSON.parse(await readFile(file, "utf8")) as Row[];
  // Sheet employee ID → TMP placeholder from the asset import (matched by name + location, checked by hand).
  const PLACEHOLDER = JSON.parse(await readFile("legacy/employee-placeholders.json", "utf8")) as Record<string, string>;

  const [employees, locations, departments] = await Promise.all([
    db.employee.findMany({ select: { id: true, employeeCode: true, name: true, phone: true } }),
    db.location.findMany({ where: { deletedAt: null } }),
    db.department.findMany({ where: { deletedAt: null } }),
  ]);
  const byCode = new Map(employees.map((e) => [e.employeeCode.toUpperCase(), e]));
  let tmpSeq = Math.max(0, ...employees.map((e) => Number(e.employeeCode.match(/^TMP-(\d+)$/)?.[1] ?? 0))) + 1;

  async function locationId(raw: string) {
    if (!raw) return null;
    const name = LOCATION_ALIASES[raw.toLowerCase()] ?? raw;
    let loc = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!loc && !dryRun) {
      loc = await db.location.create({ data: { name } });
      locations.push(loc);
      console.log(`+ location ${name}`);
    }
    return loc?.id ?? null;
  }
  async function departmentId(raw: string) {
    if (!raw) return null;
    let dep = departments.find((d) => d.name.toLowerCase() === raw.toLowerCase());
    if (!dep && !dryRun) {
      dep = await db.department.create({ data: { name: raw } });
      departments.push(dep);
    }
    return dep?.id ?? null;
  }

  const stats = { updated: 0, created: 0 };
  for (const r of rows) {
    const code = r.code || "";
    const existing =
      (code && byCode.get(code.toUpperCase())) ||
      (PLACEHOLDER[code] ? byCode.get(PLACEHOLDER[code]) : undefined) ||
      // No ID in the sheet: fall back to an exact name match so re-runs don't duplicate.
      (!code ? [...byCode.values()].find((e) => e.name.toLowerCase() === r.name.toLowerCase()) : undefined);
    const newCode = code || existing?.employeeCode || `TMP-${String(tmpSeq++).padStart(4, "0")}`;
    const notes = [`Company: ${r.company}.`, r.userType && `User type: ${r.userType}.`, !code && "No employee ID in the employee list; replace the TMP ID."]
      .filter(Boolean)
      .join("\n");
    const oldPhone = existing?.phone && existing.phone !== r.phone ? `\nOther number on record: ${existing.phone}.` : "";

    if (dryRun) {
      console.log(`${existing ? `UPDATE ${existing.employeeCode} "${existing.name}" →` : "CREATE"} ${newCode} ${r.name} | ${r.department} | ${r.designation} | ${r.location} | ${r.phone}`);
      continue;
    }
    const data = {
      employeeCode: newCode,
      name: r.name,
      phone: r.phone || null,
      designation: r.designation || null,
      departmentId: await departmentId(r.department),
      locationId: await locationId(r.location),
      status: "ACTIVE" as const,
      notes: notes + oldPhone,
    };
    if (existing) {
      const before = await db.employee.findUniqueOrThrow({ where: { id: existing.id } });
      const after = await db.employee.update({ where: { id: existing.id }, data });
      await db.auditLog.create({ data: { action: "UPDATE", entityType: "Employee", entityId: after.id, entityLabel: `${after.name} (employee list import)`, before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(after)) } });
      byCode.set(newCode.toUpperCase(), { ...existing, employeeCode: newCode });
      stats.updated++;
    } else {
      const created = await db.employee.create({ data });
      await db.auditLog.create({ data: { action: "CREATE", entityType: "Employee", entityId: created.id, entityLabel: `${created.name} (employee list import)`, after: JSON.parse(JSON.stringify(created)) } });
      byCode.set(newCode.toUpperCase(), { id: created.id, employeeCode: newCode, name: created.name, phone: created.phone });
      stats.created++;
    }
  }
  console.log(`\nUpdated: ${stats.updated} · created: ${stats.created}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
