"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { decrypt, encrypt } from "@/lib/crypto";
import { parseDateInput, parseOptionalDate } from "@/lib/dates";
import { SYSTEM_CATEGORY } from "@/lib/options";
import { orNull } from "@/lib/validation";
import type { Tx } from "@/lib/db";
import {
  ACCOUNT_CSV_HEADERS,
  accountImportSchema,
  accountSchema,
  accountUpdateSchema,
  closeAccountsSchema,
  systemSchema,
  systemUpdateSchema,
  type AccountInput,
  type SystemInput,
} from "./schema";

// ─── Systems ─────────────────────────────────────────────────────────────────

const systemData = (v: SystemInput) => ({
  name: v.name,
  category: v.category,
  loginUrl: orNull(v.loginUrl),
  vendorId: orNull(v.vendorId),
  offboardingSteps: orNull(v.offboardingSteps),
  notes: orNull(v.notes),
});

async function assertSystemNameFree(tx: Tx, name: string, exceptId?: string) {
  const clash = await tx.appSystem.findFirst({ where: { deletedAt: null, name: { equals: name, mode: "insensitive" }, id: exceptId ? { not: exceptId } : undefined } });
  if (clash) throw new ActionError(`“${clash.name}” already exists.`, { name: "Already exists" });
}

export const createSystem = createAction({
  schema: systemSchema,
  handler: async (input, { tx, audit }) => {
    await assertSystemNameFree(tx, input.name);
    const system = await tx.appSystem.create({ data: systemData(input) });
    await audit({ action: "CREATE", entityType: "AppSystem", entityId: system.id, entityLabel: system.name, after: system });
    return { id: system.id, name: system.name };
  },
});

export const updateSystem = createAction({
  schema: systemUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.appSystem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("System not found.");
    await assertSystemNameFree(tx, data.name, id);
    const after = await tx.appSystem.update({ where: { id }, data: systemData(data) });
    await audit({ action: "UPDATE", entityType: "AppSystem", entityId: id, entityLabel: after.name, before, after });
    return { id };
  },
});

export const archiveSystem = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.appSystem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("System not found.");
    const active = await tx.employeeAccount.count({ where: { systemId: id, deletedAt: null, status: "ACTIVE" } });
    if (active > 0) throw new ActionError(`${active} active account(s) still use ${before.name}. Close them first.`);
    const after = await tx.appSystem.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "AppSystem", entityId: id, entityLabel: before.name, before, after });
    return { id };
  },
});

// ─── Accounts ────────────────────────────────────────────────────────────────

/** Audit snapshots never include the ciphertext. */
const redact = <T extends { passwordEnc?: string | null }>(a: T, changed = false) => ({
  ...a,
  passwordEnc: a.passwordEnc ? (changed ? "••• (encrypted, changed)" : "••• (encrypted)") : null,
});

const accountData = (v: AccountInput) => ({
  employeeId: v.employeeId,
  systemId: v.systemId,
  username: v.username,
  accessLevel: orNull(v.accessLevel),
  mfaEnabled: v.mfaEnabled,
  personal: v.personal,
  grantedAt: parseOptionalDate(v.grantedAt),
  notes: orNull(v.notes),
});

async function loadRefs(tx: Tx, v: AccountInput) {
  const [employee, system] = await Promise.all([
    tx.employee.findFirst({ where: { id: v.employeeId, deletedAt: null }, select: { name: true } }),
    tx.appSystem.findFirst({ where: { id: v.systemId, deletedAt: null }, select: { name: true } }),
  ]);
  if (!employee) throw new ActionError("Choose an employee.", { employeeId: "Not found" });
  if (!system) throw new ActionError("Choose a system.", { systemId: "Not found" });
  return { employee, system };
}

async function assertNoActiveDuplicate(tx: Tx, v: AccountInput, exceptId?: string) {
  const dup = await tx.employeeAccount.findFirst({
    where: { deletedAt: null, status: "ACTIVE", employeeId: v.employeeId, systemId: v.systemId, username: { equals: v.username, mode: "insensitive" }, id: exceptId ? { not: exceptId } : undefined },
  });
  if (dup) throw new ActionError("This login is already recorded for this employee.", { username: "Already recorded" });
}

const label = (employee: string, system: string, username: string) => `${system} · ${username} (${employee})`;

export const createAccount = createAction({
  schema: accountSchema,
  handler: async (input, { tx, audit }) => {
    const { employee, system } = await loadRefs(tx, input);
    await assertNoActiveDuplicate(tx, input);
    const account = await tx.employeeAccount.create({ data: { ...accountData(input), passwordEnc: input.password ? encrypt(input.password) : null } });
    await audit({ action: "CREATE", entityType: "EmployeeAccount", entityId: account.id, entityLabel: label(employee.name, system.name, account.username), after: redact(account) });
    return { id: account.id };
  },
});

export const updateAccount = createAction({
  schema: accountUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.employeeAccount.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Account not found.");
    const { employee, system } = await loadRefs(tx, data);
    if (before.status === "ACTIVE") await assertNoActiveDuplicate(tx, data, id);
    const passwordEnc = data.clearPassword ? null : data.password ? encrypt(data.password) : before.passwordEnc;
    const after = await tx.employeeAccount.update({ where: { id }, data: { ...accountData(data), passwordEnc } });
    await audit({
      action: "UPDATE",
      entityType: "EmployeeAccount",
      entityId: id,
      entityLabel: label(employee.name, system.name, after.username),
      before: redact(before),
      after: redact(after, !!data.password),
    });
    return { id };
  },
});

/** Mark one or many accounts as blocked/removed (the offboarding step). Already-closed ones are skipped. */
export const closeAccounts = createAction({
  schema: closeAccountsSchema,
  handler: async ({ ids, status, note }, { tx, audit, user }) => {
    const open = await tx.employeeAccount.findMany({
      where: { id: { in: ids }, deletedAt: null, status: "ACTIVE" },
      include: { employee: { select: { name: true } }, system: { select: { name: true } } },
    });
    if (!open.length) throw new ActionError("Those accounts are already closed.");
    const closedAt = new Date();
    for (const a of open) {
      const after = await tx.employeeAccount.update({ where: { id: a.id }, data: { status, closedAt, closedById: user.id, closeNote: orNull(note) } });
      const { employee, system, ...before } = a;
      await audit({ action: "UPDATE", entityType: "EmployeeAccount", entityId: a.id, entityLabel: label(employee.name, system.name, a.username), before: redact(before), after: redact(after) });
    }
    return { closed: open.length };
  },
});

export const reopenAccount = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.employeeAccount.findFirst({ where: { id, deletedAt: null }, include: { employee: { select: { name: true } }, system: { select: { name: true } } } });
    if (!before) throw new ActionError("Account not found.");
    if (before.status === "ACTIVE") throw new ActionError("This account is already active.");
    const { employee, system, ...rest } = before;
    const after = await tx.employeeAccount.update({ where: { id }, data: { status: "ACTIVE", closedAt: null, closedById: null, closeNote: null } });
    await audit({ action: "UPDATE", entityType: "EmployeeAccount", entityId: id, entityLabel: label(employee.name, system.name, before.username), before: redact(rest), after: redact(after) });
    return { id };
  },
});

/** Removes a record entered by mistake. Real offboarding uses closeAccounts so the history stays. */
export const archiveAccount = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.employeeAccount.findFirst({ where: { id, deletedAt: null }, include: { employee: { select: { id: true, name: true } }, system: { select: { name: true } } } });
    if (!before) throw new ActionError("Account not found.");
    const { employee, system, ...rest } = before;
    const after = await tx.employeeAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "EmployeeAccount", entityId: id, entityLabel: label(employee.name, system.name, before.username), before: redact(rest), after: redact(after) });
    return { employeeId: employee.id };
  },
});

/** Decrypts the stored password for display. Every reveal is written to the audit log (never the value). */
export const revealAccountPassword = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const a = await tx.employeeAccount.findFirst({
      where: { id, deletedAt: null },
      select: { passwordEnc: true, username: true, employee: { select: { name: true } }, system: { select: { name: true } } },
    });
    if (!a?.passwordEnc) throw new ActionError("No password stored for this account.");
    let value: string;
    try {
      value = decrypt(a.passwordEnc);
    } catch {
      throw new ActionError("Couldn't decrypt — was ENCRYPTION_KEY changed?");
    }
    await audit({ action: "REVEAL", entityType: "EmployeeAccount", entityId: id, entityLabel: label(a.employee.name, a.system.name, a.username) });
    return { value };
  },
});

/** CSV import. Matches employees by employee ID and systems by name (unknown systems are created as Other). */
export const importAccounts = createAction({
  schema: accountImportSchema,
  handler: async ({ rows }, { tx, audit }) => {
    const [header, ...body] = rows;
    const cols = header.map((h) => h.trim().toLowerCase());
    const idx = Object.fromEntries(ACCOUNT_CSV_HEADERS.map((h) => [h, cols.indexOf(h)]));
    if (idx.employee_id < 0 || idx.system < 0 || idx.login_id < 0) {
      throw new ActionError("The CSV needs at least the employee_id, system and login_id columns. Download the template to see the format.");
    }

    const [employees, systems, existing] = await Promise.all([
      tx.employee.findMany({ where: { deletedAt: null }, select: { id: true, name: true, employeeCode: true } }),
      tx.appSystem.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
      tx.employeeAccount.findMany({ where: { deletedAt: null, status: "ACTIVE" }, select: { employeeId: true, systemId: true, username: true } }),
    ]);
    const empByCode = new Map(employees.map((e) => [e.employeeCode.toUpperCase(), e]));
    const sysByName = new Map(systems.map((s) => [s.name.toLowerCase(), s]));
    const seen = new Set(existing.map((a) => `${a.employeeId}|${a.systemId}|${a.username.toLowerCase()}`));
    const yes = (v: string) => /^(y|yes|true|1)$/i.test(v);

    const errors: string[] = [];
    let created = 0;
    let skipped = 0;
    for (const [i, row] of body.entries()) {
      const get = (key: (typeof ACCOUNT_CSV_HEADERS)[number]) => (idx[key] >= 0 ? (row[idx[key]] ?? "").trim() : "");
      const line = i + 2;
      if (row.every((c) => !c.trim())) continue;
      const code = get("employee_id").toUpperCase();
      const systemName = get("system");
      const username = get("login_id");
      const granted = get("granted_on");
      if (!code || !systemName || !username) {
        errors.push(`Row ${line}: employee_id, system and login_id are required`);
        continue;
      }
      const employee = empByCode.get(code);
      if (!employee) {
        errors.push(`Row ${line}: no employee with ID "${code}"`);
        continue;
      }
      if (granted && !/^\d{4}-\d{2}-\d{2}$/.test(granted)) {
        errors.push(`Row ${line}: granted_on must be YYYY-MM-DD`);
        continue;
      }
      if (username.length > 200 || systemName.length > 120) {
        errors.push(`Row ${line}: value too long`);
        continue;
      }
      let system = sysByName.get(systemName.toLowerCase());
      if (!system) {
        const s = await tx.appSystem.create({ data: { name: systemName, category: "OTHER" } });
        await audit({ action: "CREATE", entityType: "AppSystem", entityId: s.id, entityLabel: `${s.name} (CSV import, ${SYSTEM_CATEGORY.OTHER})`, after: s });
        system = { id: s.id, name: s.name };
        sysByName.set(s.name.toLowerCase(), system);
      }
      const key = `${employee.id}|${system.id}|${username.toLowerCase()}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      const account = await tx.employeeAccount.create({
        data: {
          employeeId: employee.id,
          systemId: system.id,
          username,
          accessLevel: get("access_level").slice(0, 80) || null,
          mfaEnabled: yes(get("mfa")),
          personal: yes(get("personal")),
          grantedAt: granted ? parseDateInput(granted) : null,
          notes: get("notes").slice(0, 2000) || null,
        },
      });
      await audit({ action: "CREATE", entityType: "EmployeeAccount", entityId: account.id, entityLabel: `${label(employee.name, system.name, username)} (CSV import)`, after: redact(account) });
      seen.add(key);
      created++;
    }
    return { created, skipped, errors: errors.slice(0, 20) };
  },
});
