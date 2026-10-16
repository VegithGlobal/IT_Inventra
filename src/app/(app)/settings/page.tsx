import { ChevronRight, MapPin, Network, Shapes, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  { title: "Departments", description: "Engineering, Sales, Finance…", href: "/settings/departments", icon: Network },
  { title: "Locations", description: "Offices, floors and rooms", href: "/settings/locations", icon: MapPin },
  { title: "Asset types", description: "Tag prefixes and depreciation", href: "/settings/asset-types", icon: Shapes },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Master data used across the app. Company profile, email and backups arrive in Phase 8." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:bg-subtle"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-subtle group-hover:bg-surface">
              <s.icon className="size-5 text-fg-secondary" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-fg">{s.title}</span>
              <span className="block text-[13px] text-fg-muted">{s.description}</span>
            </span>
            <ChevronRight className="size-4 text-fg-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
