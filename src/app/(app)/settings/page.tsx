import { Bell, Building, ChevronRight, DatabaseBackup, MapPin, Network, Shapes, Tags, Users, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: { label: string; items: { title: string; description: string; href: string; icon: LucideIcon }[] }[] = [
  {
    label: "Organisation",
    items: [
      { title: "Company profile", description: "Name, GSTIN, address, logo", href: "/settings/company", icon: Building },
      { title: "Users & roles", description: "Logins for the IT team", href: "/settings/users", icon: Users },
      { title: "Backup & export", description: "Download all data as a zip", href: "/settings/backup", icon: DatabaseBackup },
    ],
  },
  {
    label: "Master data",
    items: [
      { title: "Departments", description: "Engineering, Sales, Finance…", href: "/settings/departments", icon: Network },
      { title: "Locations", description: "Offices, floors and rooms", href: "/settings/locations", icon: MapPin },
      { title: "Asset types", description: "Tag prefixes and depreciation", href: "/settings/asset-types", icon: Shapes },
      { title: "Categories", description: "Expense, ticket and vendor categories", href: "/settings/categories", icon: Tags },
    ],
  },
  {
    label: "Automation",
    items: [{ title: "Notifications", description: "Reminder timing, email, scheduled job", href: "/settings/notifications", icon: Bell }],
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" />
      {GROUPS.map((g) => (
        <section key={g.label} className="flex flex-col gap-3">
          <h2 className="text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase">{g.label}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((s) => (
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
        </section>
      ))}
    </div>
  );
}
