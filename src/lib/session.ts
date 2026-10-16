import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { authOptions } from "./auth";
import { db } from "./db";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/** Reads the session and re-checks the user in the DB (deactivated users lose access at once). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true, deletedAt: true },
  });
  if (!user || !user.active || user.deletedAt) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** For pages: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const WRITE_ROLES: Role[] = ["ADMIN", "IT_STAFF"];

export function canWrite(role: Role) {
  return WRITE_ROLES.includes(role);
}
