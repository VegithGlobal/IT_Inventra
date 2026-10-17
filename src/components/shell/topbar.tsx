"use client";

import { Command } from "cmdk";
import { ChevronRight, Menu as MenuIcon, Plus, Search } from "lucide-react";
import { Dialog as D } from "radix-ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, Suspense, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { openQuickTicket } from "@/features/tickets/quick-add";
import { NAV } from "./nav";
import { Logo, NavList } from "./sidebar";

const LABELS: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items).map((i) => [i.href.slice(1), i.label]),
);
Object.assign(LABELS, {
  new: "New",
  edit: "Edit",
  calendar: "Calendar",
  departments: "Departments",
  locations: "Locations",
  "asset-types": "Asset types",
  label: "Label",
  import: "Import",
  notifications: "Notifications",
  company: "Company profile",
  users: "Users & roles",
  categories: "Categories",
  backup: "Backup",
});

/** "+ New" menu. Links open the create flow on each module's page via ?new=1. */
export const CREATE_ITEMS = [
  { label: "Log repair", href: "/maintenance?new=1" },
  { label: "Stock item", href: "/inventory?new=1" },
  { label: "License", href: "/licenses?new=1" },
  { label: "Asset", href: "/assets?new=1" },
  { label: "Assign asset", href: "/assignments?assign=1" },
  { label: "Subscription", href: "/subscriptions?new=1" },
  { label: "Expense", href: "/expenses?new=1" },
  { label: "Upload invoice", href: "/invoices?new=1" },
  { label: "Employee", href: "/employees?new=1" },
  { label: "Vendor", href: "/vendors?new=1" },
];

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return <span className="text-[13.5px] font-medium text-fg">Dashboard</span>;
  return (
    <ol className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
      {parts.map((part, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const last = i === parts.length - 1;
        const label = LABELS[part] ?? (i === 0 ? part : "Details");
        return (
          <Fragment key={href}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-muted" aria-hidden />}
            <li className="min-w-0 truncate">
              {last ? (
                <span className="font-medium text-fg" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link href={href} className="text-fg-muted hover:text-fg">
                  {label}
                </Link>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

const groupCls = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-fg-muted";

type SearchGroup = { label: string; hits: { id: string; title: string; subtitle: string; href: string }[] };

/** Debounced record search against /api/search. */
function useRecordSearch(q: string) {
  const [state, setState] = useState<{ q: string; groups: SearchGroup[] }>({ q: "", groups: [] });
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setState({ q: term, groups: ((await res.json()) as { groups: SearchGroup[] }).groups });
      } catch {
        // aborted or offline — keep the previous results
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);
  const term = q.trim();
  return { groups: term.length >= 2 && state.q === term ? state.groups : [], loading: term.length >= 2 && state.q !== term };
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { groups, loading } = useRecordSearch(q);
  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    if (href.startsWith("/api/")) window.open(href, "_blank", "noopener");
    else router.push(href);
  };
  const itemCls =
    "flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 text-[13.5px] text-fg data-[selected=true]:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted";
  const term = q.trim().toLowerCase();
  const pages = NAV.flatMap((g) => g.items).filter((i) => !term || i.label.toLowerCase().includes(term));
  const creates = [{ label: "Ticket", href: "" }, ...CREATE_ITEMS].filter((c) => !term || `new ${c.label}`.toLowerCase().includes(term));
  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ("");
      }}
    >
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-fg/20" />
        <D.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-overlay)] outline-none">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search assets, people, tickets, subscriptions and invoices, or jump to a page</D.Description>
          {/* Filtering is done here (records come pre-filtered from the server). */}
          <Command label="Search" shouldFilter={false}>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-fg-muted" aria-hidden />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Search assets, people, tickets, invoices…"
                className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-muted"
              />
              {loading && <span className="text-[12px] text-fg-muted">Searching…</span>}
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {term.length >= 2 && !loading && groups.length === 0 && pages.length === 0 && creates.length === 0 && (
                <p className="py-8 text-center text-[13px] text-fg-muted">No matches for “{q.trim()}”.</p>
              )}
              {groups.map((g) => (
                <Command.Group key={g.label} heading={g.label} className={groupCls}>
                  {g.hits.map((h) => (
                    <Command.Item key={h.id} value={`${g.label}-${h.id}`} onSelect={() => go(h.href)} className={itemCls}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{h.title}</span>
                        {h.subtitle && <span className="block truncate text-[12px] text-fg-muted">{h.subtitle}</span>}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
              {pages.length > 0 && (
                <Command.Group heading="Go to" className={groupCls}>
                  {pages.map((i) => (
                    <Command.Item key={i.href} value={`go ${i.label}`} onSelect={() => go(i.href)} className={itemCls}>
                      <i.icon />
                      {i.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {creates.length > 0 && (
                <Command.Group heading="Create" className={groupCls}>
                  {creates.map((c) =>
                    c.href ? (
                      <Command.Item key={c.href} value={`new ${c.label}`} onSelect={() => go(c.href)} className={itemCls}>
                        <Plus />
                        New {c.label.toLowerCase()}
                      </Command.Item>
                    ) : (
                      <Command.Item
                        key="ticket"
                        value="new ticket"
                        onSelect={() => {
                          onOpenChange(false);
                          setQ("");
                          openQuickTicket();
                        }}
                        className={itemCls}
                      >
                        <Plus />
                        New ticket
                        <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] text-fg-muted">N</kbd>
                      </Command.Item>
                    ),
                  )}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** "+ New" menu: a labelled button in the top bar, or a round FAB on phones. */
function CreateMenu({ fab }: { fab?: boolean }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="primary" className={fab ? "size-12 rounded-full p-0 shadow-[var(--shadow-overlay)]" : undefined} aria-label="Create new">
          <Plus />
          {!fab && "New"}
        </Button>
      </MenuTrigger>
      <MenuContent side={fab ? "top" : "bottom"}>
        <MenuItem onSelect={() => openQuickTicket()}>
          Ticket
          <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] text-fg-muted">N</kbd>
        </MenuItem>
        <MenuSeparator />
        {CREATE_ITEMS.map((c) => (
          <MenuItem key={c.href} asChild>
            <Link href={c.href}>{c.label}</Link>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function Topbar({ userCard, bell, brand }: { userCard: ReactNode; bell: ReactNode; brand: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-sm md:px-8">
      <D.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <D.Trigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <MenuIcon />
          </Button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-fg/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface shadow-[var(--shadow-overlay)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <div className="flex h-16 items-center px-4">
              <Logo mark={brand} />
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="border-t border-line p-3">{userCard}</div>
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="min-w-0 flex-1">
        <Suspense fallback={<span className="block h-5" />}>
          <Breadcrumbs />
        </Suspense>
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden h-9 w-60 items-center gap-2 rounded-md bg-subtle px-3 text-[13px] text-fg-muted transition-colors hover:bg-pressed sm:flex"
      >
        <Search className="size-4" aria-hidden />
        Search…
        <kbd className="ml-auto rounded border border-line bg-surface px-1.5 font-sans text-[11px]">Ctrl K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
        <Search />
      </Button>

      {bell}

      <div className="hidden sm:block">
        <CreateMenu />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
    {/* Phones: floating action button. Rendered outside the header — its backdrop blur would
        otherwise become the containing block for position: fixed. */}
    <div className="fixed right-4 bottom-4 z-40 sm:hidden">
      <CreateMenu fab />
    </div>
    </>
  );
}
