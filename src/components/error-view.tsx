"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shared body for error boundaries: friendly message, digest for support, retry + home. */
export function ErrorView({ error, retry, compact }: { error: Error & { digest?: string }; retry: () => void; compact?: boolean }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className={compact ? "flex flex-col items-center px-6 py-16 text-center" : "flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"} role="alert">
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-soft">
        <TriangleAlert className="size-5 text-danger" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-4 text-[18px] font-semibold text-fg">Something went wrong</h1>
      <p className="mt-1 max-w-md text-[13.5px] text-fg-secondary">
        This page hit an unexpected error. Your data is safe — try again, and if it keeps happening, check the server log.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-fg-muted">Reference: {error.digest}</p>}
      <div className="mt-5 flex gap-2">
        <Button asChild>
          <Link href="/">Go to dashboard</Link>
        </Button>
        <Button variant="primary" onClick={() => retry()}>
          <RotateCcw />
          Try again
        </Button>
      </div>
    </div>
  );
}
