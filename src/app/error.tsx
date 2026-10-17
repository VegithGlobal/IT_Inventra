"use client"; // Error boundaries must be Client Components

import { ErrorView } from "@/components/error-view";

/** Errors outside the app shell (login, print pages). */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="min-h-dvh bg-app">
      <ErrorView error={error} retry={retry} />
    </main>
  );
}
