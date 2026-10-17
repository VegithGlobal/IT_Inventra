// Production first-run setup (no demo data). Safe to run more than once — it only fills in what's missing.
//   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-strong-password' ADMIN_NAME='Your Name' npm run db:init
// Creates: default settings, asset types (with tag prefixes), built-in expense categories,
// ticket categories, and the first admin login (only if that email doesn't exist yet).

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SETTINGS: Record<string, Prisma.InputJsonObject> = {
  company: { name: process.env.COMPANY_NAME || "Your Company", gstin: null, address: null, logoKey: null, currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD-MM-YYYY" },
  reminders: { subscriptionDaysBefore: [7, 3, 1, 0], warrantyDaysBefore: 30, licenseDaysBefore: [30, 7], ticketDueHoursBefore: 4, assetReturnDaysBefore: 2 },
  emailNotifications: { SUBSCRIPTION_DUE: true, PAYMENT_OVERDUE: true, WARRANTY_EXPIRY: true, LICENSE_EXPIRY: true, LOW_STOCK: true, TICKET_DUE: false, ASSET_RETURN_DUE: true, MAINTENANCE_DUE: true, REMINDER: true },
  depreciation: { method: "STRAIGHT_LINE", defaultSalvagePercent: 5 },
};

const ASSET_TYPES: [string, string, number][] = [
  ["Laptop", "LAP", 36], ["Desktop", "DSK", 48], ["Monitor", "MON", 60], ["Printer", "PRN", 60],
  ["Router/Switch", "NET", 60], ["Access Point", "WAP", 60], ["Phone", "PHN", 24], ["Tablet", "TAB", 36],
  ["Keyboard/Mouse", "KBM", 24], ["UPS", "UPS", 48], ["Server", "SRV", 60], ["Other", "OTH", 36],
];

// Built-in categories are used by auto-created expenses (matched by name) — keep these names.
const EXPENSE_CATEGORIES: [string, string, boolean][] = [
  ["Hardware", "chart-1", true], ["Subscriptions", "chart-2", true], ["Consumables", "chart-3", true],
  ["Repairs & Maintenance", "chart-4", true], ["Services", "chart-5", false], ["Software Licenses", "chart-6", true], ["Miscellaneous", "chart-7", false],
];

const TICKET_CATEGORIES = ["Hardware", "Software", "Network/WiFi", "Email", "Printer", "Access/Account", "Server/Cloud", "Other"];

async function main() {
  const created: string[] = [];

  for (const [key, value] of Object.entries(SETTINGS)) {
    const exists = await db.setting.findUnique({ where: { key } });
    if (!exists) {
      await db.setting.create({ data: { key, value } });
      created.push(`setting ${key}`);
    }
  }
  for (const [i, [name, prefix, life]] of ASSET_TYPES.entries()) {
    const exists = await db.assetType.findFirst({ where: { OR: [{ name }, { prefix }] } });
    if (!exists) {
      await db.assetType.create({ data: { name, prefix, usefulLifeMonths: life, sortOrder: i } });
      created.push(`asset type ${name}`);
    }
  }
  for (const [i, [name, colorKey, isSystem]] of EXPENSE_CATEGORIES.entries()) {
    const exists = await db.expenseCategory.findUnique({ where: { name } });
    if (!exists) {
      await db.expenseCategory.create({ data: { name, colorKey, isSystem, sortOrder: i } });
      created.push(`expense category ${name}`);
    }
  }
  for (const [i, name] of TICKET_CATEGORIES.entries()) {
    const exists = await db.ticketCategory.findUnique({ where: { name } });
    if (!exists) {
      await db.ticketCategory.create({ data: { name, sortOrder: i } });
      created.push(`ticket category ${name}`);
    }
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) console.log(`Admin ${email} already exists — left unchanged.`);
    else {
      await db.user.create({ data: { email, name: process.env.ADMIN_NAME?.trim() || "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) } });
      created.push(`admin login ${email}`);
    }
  } else if ((await db.user.count({ where: { role: "ADMIN", active: true } })) === 0) {
    console.warn("No admin login exists yet. Re-run with ADMIN_EMAIL and ADMIN_PASSWORD set.");
  }

  console.log(created.length ? `Created:\n  - ${created.join("\n  - ")}` : "Nothing to do — everything already exists.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
