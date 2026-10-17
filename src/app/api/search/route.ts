import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type SearchHit = { id: string; title: string; subtitle: string; href: string };
export type SearchGroup = { label: string; hits: SearchHit[] };

const TAKE = 5;

/** Global search for the ⌘K palette: case-insensitive "contains" across the main records. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ groups: [] satisfies SearchGroup[] });
  const has = { contains: q, mode: "insensitive" as const };

  const [assets, employees, tickets, subscriptions, documents, vendors, licenses, items, accounts, systems] = await Promise.all([
    db.asset.findMany({
      where: { deletedAt: null, OR: [{ assetTag: has }, { name: has }, { serialNumber: has }, { model: has }, { currentHolder: { name: has } }] },
      take: TAKE,
      orderBy: { assetTag: "asc" },
      select: { id: true, assetTag: true, name: true, serialNumber: true, currentHolder: { select: { name: true } } },
    }),
    db.employee.findMany({
      where: { deletedAt: null, OR: [{ name: has }, { employeeCode: has }, { email: has }, { phone: has }] },
      take: TAKE,
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true, designation: true },
    }),
    db.ticket.findMany({
      where: { deletedAt: null, OR: [{ ticketNumber: has }, { title: has }, { requester: { name: has } }] },
      take: TAKE,
      orderBy: { seq: "desc" },
      select: { id: true, ticketNumber: true, title: true, status: true, requester: { select: { name: true } } },
    }),
    db.subscription.findMany({
      where: { deletedAt: null, OR: [{ name: has }, { accountId: has }, { vendor: { name: has } }] },
      take: TAKE,
      orderBy: { name: "asc" },
      select: { id: true, name: true, accountId: true, vendor: { select: { name: true } } },
    }),
    db.document.findMany({
      where: { deletedAt: null, OR: [{ title: has }, { invoiceNumber: has }, { fileName: has }, { vendor: { name: has } }] },
      take: TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, invoiceNumber: true, vendor: { select: { name: true } } },
    }),
    db.vendor.findMany({ where: { deletedAt: null, OR: [{ name: has }, { gstin: has }, { contactPerson: has }] }, take: TAKE, orderBy: { name: "asc" }, select: { id: true, name: true, contactPerson: true } }),
    db.license.findMany({ where: { deletedAt: null, name: has }, take: TAKE, orderBy: { name: "asc" }, select: { id: true, name: true, totalSeats: true } }),
    db.inventoryItem.findMany({ where: { deletedAt: null, OR: [{ name: has }, { sku: has }] }, take: TAKE, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, quantity: true, unit: true } }),
    db.employeeAccount.findMany({
      where: { deletedAt: null, employee: { deletedAt: null }, username: has },
      take: TAKE,
      orderBy: { username: "asc" },
      select: { id: true, username: true, status: true, employee: { select: { name: true } }, system: { select: { name: true } } },
    }),
    db.appSystem.findMany({ where: { deletedAt: null, name: has }, take: TAKE, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const groups: SearchGroup[] = [
    { label: "Assets", hits: assets.map((a) => ({ id: a.id, title: `${a.assetTag} · ${a.name}`, subtitle: [a.currentHolder?.name, a.serialNumber].filter(Boolean).join(" · "), href: `/assets/${a.id}` })) },
    { label: "Employees", hits: employees.map((e) => ({ id: e.id, title: e.name, subtitle: [e.employeeCode, e.designation].filter(Boolean).join(" · "), href: `/employees/${e.id}` })) },
    { label: "Tickets", hits: tickets.map((t) => ({ id: t.id, title: `${t.ticketNumber} · ${t.title}`, subtitle: `${t.requester.name} · ${t.status.replace(/_/g, " ").toLowerCase()}`, href: `/tickets/${t.id}` })) },
    { label: "Subscriptions", hits: subscriptions.map((s) => ({ id: s.id, title: s.name, subtitle: [s.vendor?.name, s.accountId].filter(Boolean).join(" · "), href: `/subscriptions/${s.id}` })) },
    { label: "Invoices & documents", hits: documents.map((d) => ({ id: d.id, title: d.title, subtitle: [d.invoiceNumber, d.vendor?.name].filter(Boolean).join(" · "), href: `/api/files/${d.id}` })) },
    { label: "Vendors", hits: vendors.map((v) => ({ id: v.id, title: v.name, subtitle: v.contactPerson ?? "", href: `/vendors/${v.id}` })) },
    { label: "Licenses", hits: licenses.map((l) => ({ id: l.id, title: l.name, subtitle: `${l.totalSeats} seat(s)`, href: `/licenses/${l.id}` })) },
    {
      label: "Logins",
      hits: accounts.map((a) => ({ id: a.id, title: `${a.system.name} · ${a.username}`, subtitle: `${a.employee.name}${a.status === "ACTIVE" ? "" : ` · ${a.status.toLowerCase()}`}`, href: `/accounts/${a.id}` })),
    },
    { label: "Systems", hits: systems.map((s) => ({ id: s.id, title: s.name, subtitle: "System", href: `/accounts/systems/${s.id}` })) },
    { label: "Stock", hits: items.map((i) => ({ id: i.id, title: i.name, subtitle: `${i.sku} · ${i.quantity} ${i.unit}`, href: `/inventory/${i.id}` })) },
  ].filter((g) => g.hits.length > 0);

  return Response.json({ groups });
}
