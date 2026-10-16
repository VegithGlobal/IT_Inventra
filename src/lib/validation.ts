// Shared zod building blocks. Form values stay strings (what inputs produce) so the same
// schema validates on the client (react-hook-form) and in the server action; the server
// converts with the helpers at the bottom.
import { z } from "zod";

export const text = (max = 200) => z.string().trim().max(max, `Keep it under ${max} characters`);
export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Keep it under ${max} characters`);

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
export const optionalDate = z.union([z.literal(""), dateStr]);

const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/;
export const money = (label = "Amount") =>
  z.string().trim().min(1, `${label} is required`).regex(MONEY_RE, "Enter an amount like 1234.50");
export const optionalMoney = z.string().trim().refine((v) => v === "" || MONEY_RE.test(v), "Enter an amount like 1234.50");

export const optionalEmail = z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email");
export const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a full URL starting with https://");

export const id = (label: string) => z.string().min(1, `Choose a ${label.toLowerCase()}`);
export const optionalId = z.string();

export const intStr = (label: string, min = 0, max = 100_000) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .refine((v) => Number(v) >= min && Number(v) <= max, `${label} must be between ${min} and ${max}`);

export const enumOf = <T extends Record<string, string>>(values: T) => z.enum(values);

// ─── converters (client-safe; Decimal helpers live in src/lib/decimal.ts) ─────

export const orNull = (v: string | undefined | null) => (v && v.trim() !== "" ? v.trim() : null);

/**
 * Optional upload from FormData: missing, "" or an empty File all mean "no file".
 * (`.optional()` must wrap the input side, or zod 4 treats the key as required.)
 */
export const optionalFile = z
  .union([z.instanceof(File), z.literal("")])
  .optional()
  .transform((f) => (f instanceof File && f.size > 0 ? f : undefined));
