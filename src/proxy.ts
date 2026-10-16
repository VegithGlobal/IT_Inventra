import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic auth gate: no valid session token → /login. Every page and action
// still re-checks the user server-side (src/lib/session.ts, src/lib/action.ts).
export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  const callback = request.nextUrl.pathname + request.nextUrl.search;
  if (callback !== "/") url.searchParams.set("callbackUrl", callback);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except auth endpoints, the cron endpoint (own secret), login and static assets.
  matcher: ["/((?!api/auth|api/cron|login|_next/static|_next/image|favicon.ico).*)"],
};
