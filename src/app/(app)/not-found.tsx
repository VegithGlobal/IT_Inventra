import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown inside the shell when a record doesn't exist or was archived. */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-subtle">
        <SearchX className="size-5 text-fg-muted" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-4 text-[18px] font-semibold text-fg">Not found</h1>
      <p className="mt-1 max-w-md text-[13.5px] text-fg-secondary">This record doesn&apos;t exist or has been archived. Archived records stay in the audit log.</p>
      <div className="mt-5 flex gap-2">
        <Button asChild>
          <Link href="/audit-log">Audit log</Link>
        </Button>
        <Button asChild variant="primary">
          <Link href="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
