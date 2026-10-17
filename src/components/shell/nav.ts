import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CreditCard,
  FileText,
  KeyRound,
  KeySquare,
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
};

export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
  {
    label: "Assets",
    items: [
      { label: "Assets", href: "/assets", icon: Laptop },
      { label: "Assignments", href: "/assignments", icon: ArrowLeftRight },
      { label: "Inventory", href: "/inventory", icon: Boxes },
      { label: "Licenses", href: "/licenses", icon: KeyRound },
      { label: "Maintenance", href: "/maintenance", icon: Wrench },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Subscriptions", href: "/subscriptions", icon: CreditCard },
      { label: "Expenses", href: "/expenses", icon: Wallet },
      { label: "Invoices", href: "/invoices", icon: FileText },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Reminders", href: "/reminders", icon: Bell },
    ],
  },
  {
    label: "Directory",
    items: [
      { label: "Employees", href: "/employees", icon: Users },
      { label: "Accounts & logins", href: "/accounts", icon: KeySquare },
      { label: "Vendors", href: "/vendors", icon: Building2 },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Audit Log", href: "/audit-log", icon: ScrollText },
    ],
  },
  { label: null, items: [{ label: "Settings", href: "/settings", icon: Settings }] },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
