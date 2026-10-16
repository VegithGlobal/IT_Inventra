"use client";

import { Tabs as T } from "radix-ui";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tabClass =
  "relative -mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent px-1 text-[13.5px] font-medium text-fg-muted transition-colors hover:text-fg outline-none focus-visible:text-fg";
const activeClass = "border-fg text-fg";

export const Tabs = T.Root;
export const TabsContent = (props: ComponentProps<typeof T.Content>) => <T.Content className="pt-5 outline-none" {...props} />;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-5 overflow-x-auto border-b border-line", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return <T.Trigger className={cn(tabClass, "data-[state=active]:border-fg data-[state=active]:text-fg", className)} {...props} />;
}

/** URL-driven tabs (each tab is a link), for server-rendered tab panes. */
export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="flex gap-5 overflow-x-auto border-b border-line" aria-label="Tabs">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} scroll={false} className={cn(tabClass, t.key === active && activeClass)} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-subtle px-1.5 text-[11.5px] text-fg-secondary tabular">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
