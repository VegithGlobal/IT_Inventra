import { getCurrentUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";
import { storage } from "@/lib/storage";

/** Company logo for the app shell and printouts (signed-in users only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const company = await getCompany();
  if (!company.logoKey) return new Response("No logo", { status: 404 });
  const data = await storage.get(company.logoKey);
  if (!data) return new Response("Logo file missing", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": company.logoMime ?? "image/png",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
