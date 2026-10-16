import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/features/notifications/engine";

// Daily (or hourly) reminder job. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
// automatically; for other schedulers (cron + curl, the in-process scheduler) send the same header.
// Idempotent: re-running never duplicates notifications or emails.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  const summary = await runReminders();
  return Response.json({ ok: true, ms: Date.now() - started, ...summary });
}

export const GET = handle;
export const POST = handle;
