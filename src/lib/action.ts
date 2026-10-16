import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { writeAudit, type AuditEntry } from "./audit";
import { db, type Tx } from "./db";
import { getCurrentUser, WRITE_ROLES, type CurrentUser } from "./session";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Throw inside a handler to return a user-facing error message. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export type ActionContext = {
  user: CurrentUser;
  tx: Tx;
  audit: (entry: AuditEntry) => Promise<void>;
};

type ActionConfig<S extends z.ZodType, R> = {
  schema: S;
  /** Who may run it. Defaults to ADMIN + IT_STAFF (VIEWER is read-only). */
  roles?: Role[];
  handler: (input: z.output<S>, ctx: ActionContext) => Promise<R>;
};

function flattenErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

function fromFormData(input: unknown): unknown {
  if (!(input instanceof FormData)) return input;
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of input.entries()) obj[key] = value;
  return obj;
}

/**
 * Every mutation goes through here: auth → role check → zod validation → one DB
 * transaction (handler + audit rows) → router refresh. Returns a serialisable result.
 */
export function createAction<S extends z.ZodType, R>(config: ActionConfig<S, R>) {
  return async (input: z.input<S> | FormData): Promise<ActionResult<R>> => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
    if (!(config.roles ?? WRITE_ROLES).includes(user.role)) {
      return { ok: false, error: "You don't have permission to do that." };
    }

    const parsed = config.schema.safeParse(fromFormData(input));
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error) };
    }

    try {
      const data = await db.$transaction(
        (tx) =>
          config.handler(parsed.data, {
            user,
            tx,
            audit: (entry) => writeAudit(tx, user.id, entry),
          }),
        { timeout: 20_000 },
      );
      refresh();
      return { ok: true, data };
    } catch (err) {
      if (err instanceof ActionError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, error: "A record with the same unique value already exists." };
      }
      console.error("[action]", err);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}
