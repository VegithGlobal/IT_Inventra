"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ActionError, createAction } from "@/lib/action";
import type { Tx } from "@/lib/db";
import { saveUpload, storage, UploadError } from "@/lib/storage";
import { optionalFile, orNull } from "@/lib/validation";
import { companySchema, expenseCategorySchema, resetPasswordSchema, ticketCategorySchema, userCreateSchema, userUpdateSchema } from "./schema";

const ADMIN = ["ADMIN" as const];

async function readSetting(tx: Tx, key: string) {
  const row = await tx.setting.findUnique({ where: { key } });
  return (row?.value ?? {}) as Record<string, unknown>;
}

async function writeSetting(tx: Tx, key: string, value: Prisma.InputJsonObject) {
  const before = await tx.setting.findUnique({ where: { key } });
  const after = await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return { before, after };
}

// ─── Company ──────────────────────────────────────────────────────────────────

export const saveCompany = createAction({
  schema: companySchema,
  roles: ADMIN,
  handler: async (v, { tx, audit }) => {
    const current = await readSetting(tx, "company");
    const { before, after } = await writeSetting(tx, "company", {
      ...current,
      name: v.name,
      gstin: orNull(v.gstin),
      address: orNull(v.address),
      currency: "INR",
      timezone: "Asia/Kolkata",
      dateFormat: (current.dateFormat as string) ?? "DD-MM-YYYY",
    } as Prisma.InputJsonObject);
    await audit({ action: before ? "UPDATE" : "CREATE", entityType: "Setting", entityId: after.id, entityLabel: "Company profile", before: before?.value, after: after.value });

    const dep = await writeSetting(tx, "depreciation", { method: "STRAIGHT_LINE", defaultSalvagePercent: Number(v.defaultSalvagePercent) });
    await audit({ action: dep.before ? "UPDATE" : "CREATE", entityType: "Setting", entityId: dep.after.id, entityLabel: "Depreciation defaults", before: dep.before?.value, after: dep.after.value });
    return { ok: true };
  },
});

export const uploadLogo = createAction({
  schema: z.object({ file: optionalFile }),
  roles: ADMIN,
  handler: async ({ file }, { tx, audit }) => {
    if (!file) throw new ActionError("Choose an image.", { file: "Choose an image" });
    if (!file.type.startsWith("image/")) throw new ActionError("The logo must be a PNG, JPG or WEBP image.", { file: "Image files only" });
    let stored;
    try {
      stored = await saveUpload(file, "branding");
    } catch (e) {
      if (e instanceof UploadError) throw new ActionError(e.message, { file: e.message });
      throw e;
    }
    const current = await readSetting(tx, "company");
    const previousKey = typeof current.logoKey === "string" ? current.logoKey : null;
    const { before, after } = await writeSetting(tx, "company", { ...current, logoKey: stored.fileKey, logoMime: stored.mimeType } as Prisma.InputJsonObject);
    await audit({ action: "UPDATE", entityType: "Setting", entityId: after.id, entityLabel: "Company logo", before: before?.value, after: after.value });
    if (previousKey) await storage.delete(previousKey).catch(() => undefined);
    return { ok: true };
  },
});

export const removeLogo = createAction({
  schema: z.object({}),
  roles: ADMIN,
  handler: async (_v, { tx, audit }) => {
    const current = await readSetting(tx, "company");
    const { before, after } = await writeSetting(tx, "company", { ...current, logoKey: null, logoMime: null } as Prisma.InputJsonObject);
    await audit({ action: "UPDATE", entityType: "Setting", entityId: after.id, entityLabel: "Company logo removed", before: before?.value, after: after.value });
    return { ok: true };
  },
});

// ─── Users & roles ────────────────────────────────────────────────────────────

const safeUser = <T extends { passwordHash?: string }>(u: T) => ({ ...u, passwordHash: undefined });

/** Never leave the app without an active admin. */
async function assertAdminRemains(tx: Tx, excludingId: string) {
  const admins = await tx.user.count({ where: { role: "ADMIN", active: true, deletedAt: null, id: { not: excludingId } } });
  if (admins === 0) throw new ActionError("There must always be at least one active admin.");
}

export const createUser = createAction({
  schema: userCreateSchema,
  roles: ADMIN,
  handler: async (v, { tx, audit }) => {
    const exists = await tx.user.findUnique({ where: { email: v.email } });
    if (exists) throw new ActionError("A login with this email already exists.", { email: "Already in use" });
    const user = await tx.user.create({ data: { name: v.name, email: v.email, role: v.role, passwordHash: await bcrypt.hash(v.password, 10) } });
    await audit({ action: "CREATE", entityType: "User", entityId: user.id, entityLabel: `${user.name} (${user.email})`, after: safeUser(user) });
    return { id: user.id };
  },
});

export const updateUser = createAction({
  schema: userUpdateSchema,
  roles: ADMIN,
  handler: async (v, { tx, audit, user: me }) => {
    const before = await tx.user.findFirst({ where: { id: v.id, deletedAt: null } });
    if (!before) throw new ActionError("User not found.");
    if (before.id === me.id && (v.role !== before.role || !v.active)) {
      throw new ActionError("You can't change your own role or deactivate yourself. Ask another admin.");
    }
    if (before.role === "ADMIN" && (v.role !== "ADMIN" || !v.active)) await assertAdminRemains(tx, before.id);
    const after = await tx.user.update({ where: { id: v.id }, data: { name: v.name, role: v.role, active: v.active } });
    await audit({ action: "UPDATE", entityType: "User", entityId: v.id, entityLabel: after.email, before: safeUser(before), after: safeUser(after) });
    return { id: v.id };
  },
});

export const resetPassword = createAction({
  schema: resetPasswordSchema,
  roles: ADMIN,
  handler: async ({ id, password }, { tx, audit }) => {
    const before = await tx.user.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("User not found.");
    await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    // Record that it happened, never the value.
    await audit({ action: "UPDATE", entityType: "User", entityId: id, entityLabel: `${before.email} · password reset`, before: { password: "•••" }, after: { password: "••• (changed)" } });
    return { id };
  },
});

// ─── Categories ───────────────────────────────────────────────────────────────

export const saveExpenseCategory = createAction({
  schema: expenseCategorySchema,
  roles: ADMIN,
  handler: async ({ id, name, colorKey }, { tx, audit }) => {
    if (!id) {
      const max = await tx.expenseCategory.aggregate({ _max: { sortOrder: true } });
      const created = await tx.expenseCategory.create({ data: { name, colorKey, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await audit({ action: "CREATE", entityType: "ExpenseCategory", entityId: created.id, entityLabel: name, after: created });
      return { id: created.id };
    }
    const before = await tx.expenseCategory.findUnique({ where: { id } });
    if (!before) throw new ActionError("Category not found.");
    // Auto-created expenses find system categories by name, so those names are fixed.
    if (before.isSystem && before.name !== name) throw new ActionError("Built-in categories can't be renamed (auto-created expenses use them). You can change the colour.", { name: "Built-in name is fixed" });
    const after = await tx.expenseCategory.update({ where: { id }, data: { name, colorKey } });
    await audit({ action: "UPDATE", entityType: "ExpenseCategory", entityId: id, entityLabel: name, before, after });
    return { id };
  },
});

export const saveTicketCategory = createAction({
  schema: ticketCategorySchema,
  roles: ADMIN,
  handler: async ({ id, name }, { tx, audit }) => {
    if (!id) {
      const max = await tx.ticketCategory.aggregate({ _max: { sortOrder: true } });
      const created = await tx.ticketCategory.create({ data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await audit({ action: "CREATE", entityType: "TicketCategory", entityId: created.id, entityLabel: name, after: created });
      return { id: created.id };
    }
    const before = await tx.ticketCategory.findUnique({ where: { id } });
    if (!before) throw new ActionError("Category not found.");
    const after = await tx.ticketCategory.update({ where: { id }, data: { name } });
    await audit({ action: "UPDATE", entityType: "TicketCategory", entityId: id, entityLabel: name, before, after });
    return { id };
  },
});
