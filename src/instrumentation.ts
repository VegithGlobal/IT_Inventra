// Optional in-process scheduler for self-hosting (e.g. a VPS with `next start`).
// Set CRON_MODE="internal" to have the server call /api/cron/reminders itself every hour.
// On Vercel, leave it unset — vercel.json schedules the same endpoint.

const HOUR = 3_600_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.CRON_MODE !== "internal") return;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_MODE=internal but CRON_SECRET is not set — scheduler disabled.");
    return;
  }
  const base = (process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, "");

  const tick = async () => {
    try {
      const res = await fetch(`${base}/api/cron/reminders`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
      const body = (await res.json()) as { created?: number; emailed?: number; error?: string };
      console.log(`[cron] reminders: ${res.status} · ${body.created ?? 0} new · ${body.emailed ?? 0} emailed${body.error ? ` · ${body.error}` : ""}`);
    } catch (e) {
      console.error("[cron] reminders failed:", e instanceof Error ? e.message : e);
    }
  };

  // First run a minute after boot (server is listening by then), then hourly. Idempotent, so
  // restarts and overlapping instances are harmless.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), HOUR);
  }, 60_000);
  console.log("[cron] in-process reminder scheduler enabled (hourly)");
}
