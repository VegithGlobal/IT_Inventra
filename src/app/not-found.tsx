import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 text-center">
      <p className="font-mono text-[13px] text-fg-muted">404</p>
      <h1 className="mt-2 text-[20px] font-semibold text-fg">Page not found</h1>
      <p className="mt-1 text-[13.5px] text-fg-secondary">The address may be mistyped, or the page has moved.</p>
      <Button asChild variant="primary" className="mt-5">
        <Link href="/">Go to dashboard</Link>
      </Button>
    </main>
  );
}
