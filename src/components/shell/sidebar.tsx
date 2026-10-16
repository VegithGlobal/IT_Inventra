"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import { Tip } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { BUILT_PHASE, NAV, isActive, type NavItem } from "./nav";

const STORAGE_KEY = "itops.sidebar.collapsed";
const listeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

function useCollapsed() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readCollapsed,
    () => false,
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-fg/15">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-action text-[13px] font-semibold text-action-fg">
        IT
      </span>
      {!collapsed && <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">IT Ops Hub</span>}
    </Link>
  );
}

function NavLink({ item, collapsed, onNavigate, pathname }: { item: NavItem; collapsed: boolean; onNavigate?: () => void; pathname: string | null }) {
  const active = pathname !== null && isActive(pathname, item.href);
  const soon = item.phase > BUILT_PHASE;
  const Icon = item.icon;

  const body = (
    <>
      {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden />}
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && soon && <span className="ml-auto text-[11px] text-fg-muted">Phase {item.phase}</span>}
    </>
  );
  const cls = cn(
    "relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-fg/15",
    collapsed && "justify-center px-0",
    active ? "bg-subtle font-medium text-fg" : "text-fg-secondary hover:bg-subtle hover:text-fg",
    soon && "pointer-events-none opacity-55",
  );

  const el = soon ? (
    <span className={cls} aria-disabled="true">
      {body}
    </span>
  ) : (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      {body}
    </Link>
  );

  return collapsed ? (
    <Tip label={soon ? `${item.label} · Phase ${item.phase}` : item.label} side="right">
      {el}
    </Tip>
  ) : (
    el
  );
}

type NavListProps = { collapsed?: boolean; onNavigate?: () => void };

function NavListWithPath(props: NavListProps) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

/** The pathname is request data, so it streams in behind Suspense; the fallback is the same list without highlighting. */
export function NavList(props: NavListProps) {
  return (
    <Suspense fallback={<NavLinks {...props} pathname={null} />}>
      <NavListWithPath {...props} />
    </Suspense>
  );
}

function NavLinks({ collapsed = false, onNavigate, pathname }: NavListProps & { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {NAV.map((group, i) => (
        <div key={group.label ?? i} className="flex flex-col gap-0.5">
          {group.label && !collapsed && (
            <p className="mb-1 px-3 text-[11.5px] font-medium tracking-[0.02em] text-fg-muted">{group.label}</p>
          )}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} pathname={pathname} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Desktop/tablet sidebar: 240px, collapsible to a 64px rail (remembered). */
export function Sidebar({ userCard }: { userCard: ReactNode }) {
  const collapsed = useCollapsed();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-16" : "w-16 xl:w-60",
      )}
    >
      <div className={cn("flex h-16 items-center px-4", collapsed ? "justify-center" : "justify-center xl:justify-between")}>
        <span className={cn(!collapsed && "xl:hidden")}>
          <Logo collapsed />
        </span>
        {!collapsed && (
          <span className="hidden xl:block">
            <Logo />
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className={cn(!collapsed && "xl:hidden")}>
          <NavList collapsed />
        </div>
        {!collapsed && (
          <div className="hidden xl:block">
            <NavList />
          </div>
        )}
      </div>
      <div className="border-t border-line p-3">
        <div className={cn(collapsed ? "hidden" : "hidden xl:block")}>{userCard}</div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 hidden h-8 w-full items-center justify-center gap-2 rounded-md text-[12.5px] text-fg-muted hover:bg-subtle hover:text-fg xl:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
