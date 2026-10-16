"use server";

import { z } from "zod";
import { createAction } from "@/lib/action";

// Read state is per-user UI state, not business data, so these don't write audit rows.
// Every role (including VIEWER) can manage their own notifications.
const ALL_ROLES = ["ADMIN", "IT_STAFF", "VIEWER"] as const;

export const markNotificationsRead = createAction({
  schema: z.object({ ids: z.array(z.string().min(1)).min(1).max(500), read: z.boolean() }),
  roles: [...ALL_ROLES],
  handler: async ({ ids, read }, { tx, user }) => {
    const { count } = await tx.notification.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { readAt: read ? new Date() : null } });
    return { count };
  },
});

export const markAllNotificationsRead = createAction({
  schema: z.object({}),
  roles: [...ALL_ROLES],
  handler: async (_input, { tx, user }) => {
    const { count } = await tx.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return { count };
  },
});
