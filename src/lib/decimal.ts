import "server-only";
import { Prisma } from "@/generated/prisma/client";

// Kept out of src/lib/validation.ts: that file is shared with client forms, and the Prisma
// client can't be bundled for the browser.
export const toDecimal = (v: string) => new Prisma.Decimal(v);
export const toDecimalOrNull = (v: string | undefined | null) => (v && v.trim() !== "" ? new Prisma.Decimal(v) : null);
