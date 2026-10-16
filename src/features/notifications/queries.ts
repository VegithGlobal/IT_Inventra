import "server-only";
import { db } from "@/lib/db";

const select = { id: true, type: true, title: true, body: true, href: true, readAt: true, emailedAt: true, createdAt: true } as const;

export async function getBellData(userId: string) {
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({ where: { userId }, orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 8, select }),
  ]);
  return { unread, latest };
}

export async function listNotifications(userId: string) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 500, select });
}
export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];
