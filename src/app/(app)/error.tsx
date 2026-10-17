"use client"; // Error boundaries must be Client Components

import { ErrorView } from "@/components/error-view";

/** Errors inside a page: the sidebar and top bar stay usable. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
