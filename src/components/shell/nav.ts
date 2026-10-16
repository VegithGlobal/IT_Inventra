import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  Laptop,
  ScrollText,
  Settings,
  Ticket,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Build phase that delivers the module; later phases render as disabled. */
  phase: number;
};

export type NavGroup = { label: string | null; items: NavItem[] };

/** Highest phase built so far. Modules from later phases show as "coming soon". */
export const BUILT_PHASE = 6;

export const NAV: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard, phase: 1 }] },
  {
    label: "Assets",
    items: [
      { label: "Assets", href: "/assets", icon: Laptop, phase: 3 },
      { label: "Assignments", href: "/assignments", icon: ArrowLeftRight, phase: 3 },
      { label: "Inventory", href: "/inventory", icon: Boxes, phase: 7 },
      { label: "Licenses", href: "/licenses", icon: KeyRound, phase: 7 },
      { label: "Maintenance", href: "/maintenance", icon: Wrench, phase: 6 },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Subscriptions", href: "/subscriptions", icon: CreditCard, phase: 4 },
      { label: "Expenses", href: "/expenses", icon: Wallet, phase: 4 },
      { label: "Invoices", href: "/invoices", icon: FileText, phase: 4 },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Tickets", href: "/tickets", icon: Ticket, phase: 6 },
      { label: "Reminders", href: "/reminders", icon: Bell, phase: 5 },
    ],
  },
  {
    label: "Directory",
    items: [
      { label: "Employees", href: "/employees", icon: Users, phase: 2 },
      { label: "Vendors", href: "/vendors", icon: Building2, phase: 2 },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, phase: 8 },
      { label: "Audit Log", href: "/audit-log", icon: ScrollText, phase: 8 },
    ],
  },
  { label: null, items: [{ label: "Settings", href: "/settings", icon: Settings, phase: 2 }] },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
