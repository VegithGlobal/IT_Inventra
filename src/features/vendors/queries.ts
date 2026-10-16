import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

export async function listVendors() {
  const [vendors, spend] = await Promise.all([
    db.vendor.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            assets: { where: { deletedAt: null } },
            subscriptions: { where: { deletedAt: null, status: "ACTIVE" } },
          },
        },
      },
    }),
    db.expense.groupBy({ by: ["vendorId"], where: { deletedAt: null, vendorId: { not: null } }, _sum: { total: true } }),
  ]);
  const spendBy = new Map(spend.map((s) => [s.vendorId, toNumber(s._sum.total)]));
  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    contactPerson: v.contactPerson,
    phone: v.phone,
    email: v.email,
    gstin: v.gstin,
    website: v.website,
    address: v.address,
    notes: v.notes,
    assetCount: v._count.assets,
    subscriptionCount: v._count.subscriptions,
    totalSpend: spendBy.get(v.id) ?? 0,
  }));
}
export type VendorRow = Awaited<ReturnType<typeof listVendors>>[number];

export async function getVendor(id: string) {
  const vendor = await db.vendor.findFirst({
    where: { id, deletedAt: null },
    include: {
      assets: { where: { deletedAt: null }, include: { type: true }, orderBy: { purchaseDate: "desc" } },
      subscriptions: { where: { deletedAt: null }, orderBy: { nextDueDate: "asc" } },
      expenses: { where: { deletedAt: null }, include: { category: true }, orderBy: { date: "desc" }, take: 50 },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!vendor) return null;
  const total = await db.expense.aggregate({ where: { vendorId: id, deletedAt: null }, _sum: { total: true }, _count: true });
  return { vendor, totalSpend: toNumber(total._sum.total), expenseCount: total._count };
}
