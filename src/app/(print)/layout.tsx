import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

/** Bare layout for printable forms and labels (no app shell). */
export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-app print:bg-surface">{children}</div>;
}
