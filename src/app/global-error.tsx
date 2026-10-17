"use client"; // Error boundaries must be Client Components

import "./globals.css";

/** Last-resort boundary: replaces the root layout, so it brings its own document and styles. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh bg-app font-sans text-fg antialiased">
        <title>Something went wrong · IT Ops Hub</title>
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" role="alert">
          <h1 className="text-[18px] font-semibold">Something went wrong</h1>
          <p className="mt-1 max-w-md text-[13.5px] text-fg-secondary">The app couldn&apos;t load. Try again, or reload the page.</p>
          {error.digest && <p className="mt-2 font-mono text-[12px] text-fg-muted">Reference: {error.digest}</p>}
          <button type="button" onClick={() => retry()} className="mt-5 h-9 rounded-md bg-action px-4 text-[13.5px] font-medium text-action-fg hover:bg-action-hover">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
