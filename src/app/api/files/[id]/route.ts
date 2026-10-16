import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

// Streams a stored document to signed-in users. ?download=1 forces a download.
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const doc = await db.document.findFirst({ where: { id, deletedAt: null } });
  if (!doc) return new Response("Not found", { status: 404 });

  const data = await storage.get(doc.fileKey);
  if (!data) return new Response("File missing from storage", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const name = encodeURIComponent(doc.fileName);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
