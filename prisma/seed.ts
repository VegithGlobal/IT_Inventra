// Seed: realistic sample data for a ~25-person Indian company. Wipes and recreates everything.
// Run: npx prisma db seed   (login: admin@company.com / $SEED_ADMIN_PASSWORD, default "Admin@123")

import "dotenv/config";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import type {
  AssetCondition,
  AssetStatus,
  BillingCycle,
  PaymentMode,
  SystemCategory,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from "../src/generated/prisma/enums";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ─── helpers ────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const istToday = (() => {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
})();
const daysFromToday = (n: number) => new Date(istToday.getTime() + n * DAY);
const addMonths = (date: Date, months: number) => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), last)));
};
const cycleMonths: Record<Exclude<BillingCycle, "CUSTOM">, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };

let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const money = (n: number) => new Prisma.Decimal(n.toFixed(2));
/** Split a GST-inclusive total (18%) into base + tax. */
const gstSplit = (total: number) => {
  const base = Math.round((total / 1.18) * 100) / 100;
  return { amount: money(base), taxAmount: money(total - base), total: money(total) };
};

/** Minimal valid one-page PDF with text lines — so the document vault has real previews. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);
  const text = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 18 : 11} Tf 56 ${770 - i * (i === 0 ? 0 : 20) - (i > 0 ? 20 : 0)} Td (${esc(l)}) Tj ET`)
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./uploads");
async function storePdf(lines: string[]) {
  const data = makePdf(lines);
  const key = `documents/seed/${randomUUID()}.pdf`;
  await mkdir(path.join(uploadRoot, "documents/seed"), { recursive: true });
  await writeFile(path.join(uploadRoot, key), data);
  return { fileKey: key, mimeType: "application/pdf", sizeBytes: data.length };
}

// ─── wipe ───────────────────────────────────────────────────────────────────

async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await rm(path.join(uploadRoot, "documents/seed"), { recursive: true, force: true });
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  // This wipes every table. Never let it run against a live install by accident.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to wipe the database with demo data in production. Use npm run db:init for a real install (or set ALLOW_DEMO_SEED=1).");
  }
  await wipe();

  // Users (app logins)
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  const hash = await bcrypt.hash(password, 10);
  const admin = await db.user.create({ data: { name: "Admin", email: "admin@company.com", passwordHash: hash, role: "ADMIN" } });
  await db.user.create({ data: { name: "Sneha Pawar", email: "staff@company.com", passwordHash: hash, role: "IT_STAFF" } });
  await db.user.create({ data: { name: "Rakesh Iyer", email: "viewer@company.com", passwordHash: hash, role: "VIEWER" } });

  // Settings
  await db.setting.createMany({
    data: [
      {
        key: "company",
        value: { name: "Northwind Technologies Pvt Ltd", gstin: "27AAHCN4521Q1ZS", address: "Baner Road, Pune 411045", logoKey: null, currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD-MM-YYYY" },
      },
      { key: "reminders", value: { subscriptionDaysBefore: [7, 3, 1, 0], warrantyDaysBefore: 30, licenseDaysBefore: [30, 7], ticketDueHoursBefore: 4, assetReturnDaysBefore: 2 } },
      {
        key: "emailNotifications",
        value: { SUBSCRIPTION_DUE: true, PAYMENT_OVERDUE: true, WARRANTY_EXPIRY: true, LICENSE_EXPIRY: true, LOW_STOCK: true, TICKET_DUE: false, ASSET_RETURN_DUE: true, MAINTENANCE_DUE: true, REMINDER: true },
      },
      { key: "depreciation", value: { method: "STRAIGHT_LINE", defaultSalvagePercent: 5 } },
    ],
  });

  // Master data
  const deptNames: [string, string][] = [
    ["Engineering", "ENG"], ["Sales", "SAL"], ["Marketing", "MKT"], ["Finance", "FIN"],
    ["Human Resources", "HR"], ["Operations", "OPS"], ["Customer Support", "CS"], ["Management", "MGT"],
  ];
  const depts = await Promise.all(deptNames.map(([name, code]) => db.department.create({ data: { name, code } })));
  const dept = (code: string) => depts.find((d) => d.code === code)!.id;

  const locs = await Promise.all(
    [
      { name: "Pune HQ · Floor 3", city: "Pune", address: "Baner Road, Pune 411045" },
      { name: "Pune HQ · Floor 4", city: "Pune", address: "Baner Road, Pune 411045" },
      { name: "Pune HQ · Server Room", city: "Pune", address: "Baner Road, Pune 411045" },
      { name: "Mumbai · Andheri East", city: "Mumbai", address: "MIDC, Andheri East, Mumbai 400093" },
      { name: "Bengaluru · Koramangala", city: "Bengaluru", address: "5th Block, Koramangala, Bengaluru 560095" },
      { name: "Remote", city: null, address: null },
    ].map((l) => db.location.create({ data: l })),
  );
  const [puneF3, puneF4, serverRoom, mumbai, blr, remote] = locs;

  const vendorRows: { name: string; category: string; contactPerson?: string; phone?: string; email?: string; gstin?: string; website?: string; address?: string }[] = [
    { name: "Bharti Airtel Ltd", category: "ISP", contactPerson: "Airtel Business Care", phone: "121", email: "business.care@airtel.com", gstin: "27AAACB2894G1ZP", website: "https://www.airtel.in/business" },
    { name: "Reliance Jio Infocomm", category: "ISP", contactPerson: "JioBusiness Support", phone: "1800-889-9999", email: "care@jio.com", gstin: "27AABCI6363G1ZR", website: "https://www.jio.com/business" },
    { name: "Amazon Web Services India", category: "CLOUD", email: "aws-india-billing@amazon.com", gstin: "27AAJCA6203B1Z2", website: "https://aws.amazon.com" },
    { name: "Hostinger International", category: "CLOUD", website: "https://www.hostinger.in" },
    { name: "Microsoft Corporation (India)", category: "SOFTWARE", gstin: "27AAACM5586G1ZL", website: "https://www.microsoft.com/en-in" },
    { name: "Quick Heal Technologies", category: "SOFTWARE", contactPerson: "Pradeep Joshi", phone: "+91 20 6681 3232", gstin: "27AAACC8463F1ZR", website: "https://www.quickheal.co.in", address: "Pune" },
    { name: "GoDaddy India", category: "OTHER", website: "https://in.godaddy.com" },
    { name: "Vodafone Idea (Vi Business)", category: "ISP", phone: "1800-123-9999", website: "https://www.myvi.in/business" },
    { name: "Dell Technologies India", category: "HARDWARE", contactPerson: "Karan Mehta", phone: "+91 98220 14567", email: "karan.mehta@dell.example.in", gstin: "29AAACD3856M1ZT", website: "https://www.dell.com/en-in" },
    { name: "HP India Sales", category: "HARDWARE", contactPerson: "Anita Rao", phone: "+91 99000 22311", gstin: "29AAACH1925Q1Z6", website: "https://www.hp.com/in-en" },
    { name: "Lenovo India", category: "HARDWARE", gstin: "29AAACL7643B1ZW", website: "https://www.lenovo.com/in" },
    { name: "Croma Business", category: "HARDWARE", contactPerson: "Business Desk", phone: "+91 72101 22100", website: "https://www.croma.com" },
    { name: "TechCare Service Centre", category: "SERVICE_CENTER", contactPerson: "Imran Shaikh", phone: "+91 98901 55432", address: "Aundh, Pune 411007", gstin: "27BQZPS4421K1Z3" },
    { name: "PowerSafe UPS Solutions", category: "SERVICE_CENTER", contactPerson: "Mahesh Kulkarni", phone: "+91 98230 77881", address: "Bhosari MIDC, Pune" },
    { name: "Ingram Micro India", category: "HARDWARE", website: "https://in.ingrammicro.com" },
    { name: "Sai Stationery & Consumables", category: "OTHER", contactPerson: "Sunil Patil", phone: "+91 98500 31122", address: "Baner, Pune" },
  ];
  const vendors = await Promise.all(vendorRows.map((v) => db.vendor.create({ data: v })));
  const vendor = (prefix: string) => vendors.find((v) => v.name.startsWith(prefix))!.id;

  const typeRows: [string, string, number][] = [
    ["Laptop", "LAP", 36], ["Desktop", "DSK", 48], ["Monitor", "MON", 60], ["Printer", "PRN", 60],
    ["Router/Switch", "NET", 60], ["Access Point", "WAP", 60], ["Phone", "PHN", 24], ["Tablet", "TAB", 36],
    ["Keyboard/Mouse", "KBM", 24], ["UPS", "UPS", 48], ["Server", "SRV", 60], ["Other", "OTH", 36],
  ];
  const types = await Promise.all(
    typeRows.map(([name, prefix, life], i) => db.assetType.create({ data: { name, prefix, usefulLifeMonths: life, sortOrder: i } })),
  );
  const typeByPrefix = (p: string) => types.find((t) => t.prefix === p)!;

  const expCats = await Promise.all(
    [
      ["Hardware", "chart-1", true], ["Subscriptions", "chart-2", true], ["Repairs & Maintenance", "chart-4", true],
      ["Consumables", "chart-3", true], ["Software Licenses", "chart-6", true], ["Services", "chart-5", false], ["Miscellaneous", "chart-7", false],
    ].map(([name, colorKey, isSystem], i) =>
      db.expenseCategory.create({ data: { name: name as string, colorKey: colorKey as string, isSystem: isSystem as boolean, sortOrder: i } }),
    ),
  );
  const cat = (name: string) => expCats.find((c) => c.name === name)!.id;

  const ticketCats = await Promise.all(
    ["Hardware", "Software", "Network/WiFi", "Email", "Printer", "Access/Account", "Server/Cloud", "Other"].map((name, i) =>
      db.ticketCategory.create({ data: { name, sortOrder: i } }),
    ),
  );
  const tcat = (name: string) => ticketCats.find((c) => c.name === name)!.id;

  // Employees
  const people: [string, string, string, typeof puneF3][] = [
    ["Aarav Sharma", "Senior Software Engineer", "ENG", puneF3], ["Priya Deshmukh", "Engineering Manager", "ENG", puneF3],
    ["Rohan Kulkarni", "Software Engineer", "ENG", puneF3], ["Ananya Iyer", "QA Engineer", "ENG", puneF3],
    ["Vikram Singh", "DevOps Engineer", "ENG", puneF3], ["Sneha Joshi", "Frontend Engineer", "ENG", remote],
    ["Karthik Reddy", "Backend Engineer", "ENG", blr], ["Meera Nair", "Product Designer", "ENG", blr],
    ["Amit Patil", "Sales Manager", "SAL", mumbai], ["Neha Gupta", "Account Executive", "SAL", mumbai],
    ["Rahul Verma", "Business Development Executive", "SAL", mumbai], ["Pooja Mehta", "Marketing Lead", "MKT", puneF4],
    ["Arjun Rao", "Content Strategist", "MKT", puneF4], ["Kavya Menon", "Finance Manager", "FIN", puneF4],
    ["Suresh Pillai", "Accountant", "FIN", puneF4], ["Divya Kapoor", "HR Manager", "HR", puneF4],
    ["Nikhil Jain", "Talent Acquisition Specialist", "HR", puneF4], ["Siddharth Kulkarni", "Operations Executive", "OPS", puneF4],
    ["Ishita Banerjee", "Support Team Lead", "CS", puneF4], ["Manoj Yadav", "Support Executive", "CS", puneF4],
    ["Tanvi Shah", "Support Executive", "CS", remote], ["Rajesh Agarwal", "Chief Executive Officer", "MGT", puneF4],
    ["Lakshmi Srinivasan", "Chief Operating Officer", "MGT", blr], ["Harsh Vardhan", "Software Engineer (ex)", "ENG", puneF3],
  ];
  const employees = await Promise.all(
    people.map(([name, designation, code, loc], i) => {
      const first = name.split(" ")[0].toLowerCase();
      const last = name.split(" ").slice(-1)[0].toLowerCase().replace(/[^a-z]/g, "");
      const exited = i === people.length - 1;
      const leaving = name === "Siddharth Kulkarni";
      return db.employee.create({
        data: {
          employeeCode: `NW${String(1001 + i)}`,
          name,
          email: `${first}.${last}@northwind.in`,
          phone: `+91 9${String(8100000000 + i * 7919713).slice(0, 9)}`,
          designation,
          departmentId: dept(code),
          locationId: loc.id,
          // Before any asset was issued to them (oldest seeded asset is ~3.6 years old).
          joiningDate: daysFromToday(-Math.round(1400 + rand() * 900)),
          exitDate: exited ? daysFromToday(-40) : leaving ? daysFromToday(12) : null,
          status: exited ? "EXITED" : leaving ? "LEAVING" : "ACTIVE",
        },
      });
    }),
  );
  const emp = (name: string) => employees.find((e) => e.name === name)!;
  const activeEmployees = employees.filter((e) => e.status !== "EXITED");

  // Assets
  type AssetSeed = {
    prefix: string; name: string; brand: string; model: string; cost: number; ageDays: number; vendor: string;
    status?: AssetStatus; holder?: string; location?: typeof puneF3; specs?: Record<string, string>; condition?: AssetCondition; warrantyYears?: number;
  };
  const assetSeeds: AssetSeed[] = [
    { prefix: "LAP", name: "Dell Latitude 5440", brand: "Dell", model: "Latitude 5440", cost: 78500, ageDays: 420, vendor: "Dell", holder: "Aarav Sharma", specs: { cpu: "Intel Core i7-1355U", ram: "16 GB", storage: "512 GB SSD" }, warrantyYears: 3 },
    { prefix: "LAP", name: "Dell Latitude 5440", brand: "Dell", model: "Latitude 5440", cost: 78500, ageDays: 420, vendor: "Dell", holder: "Priya Deshmukh", specs: { cpu: "Intel Core i7-1355U", ram: "16 GB", storage: "512 GB SSD" }, warrantyYears: 3 },
    { prefix: "LAP", name: "Lenovo ThinkPad E14 Gen 5", brand: "Lenovo", model: "ThinkPad E14 G5", cost: 68900, ageDays: 300, vendor: "Lenovo", holder: "Rohan Kulkarni", specs: { cpu: "AMD Ryzen 7 7730U", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "Lenovo ThinkPad E14 Gen 5", brand: "Lenovo", model: "ThinkPad E14 G5", cost: 68900, ageDays: 300, vendor: "Lenovo", holder: "Ananya Iyer", specs: { cpu: "AMD Ryzen 7 7730U", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "Apple MacBook Air M2", brand: "Apple", model: "MacBook Air 13 M2", cost: 104900, ageDays: 520, vendor: "Croma", holder: "Meera Nair", specs: { cpu: "Apple M2", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "HP ProBook 440 G10", brand: "HP", model: "ProBook 440 G10", cost: 64200, ageDays: 690, vendor: "HP", holder: "Amit Patil", specs: { cpu: "Intel Core i5-1335U", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "HP ProBook 440 G10", brand: "HP", model: "ProBook 440 G10", cost: 64200, ageDays: 690, vendor: "HP", holder: "Neha Gupta", specs: { cpu: "Intel Core i5-1335U", ram: "8 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "Dell Vostro 3520", brand: "Dell", model: "Vostro 3520", cost: 52400, ageDays: 980, vendor: "Dell", holder: "Siddharth Kulkarni", specs: { cpu: "Intel Core i5-1235U", ram: "8 GB", storage: "512 GB SSD" }, condition: "FAIR" },
    { prefix: "LAP", name: "Dell Vostro 3520", brand: "Dell", model: "Vostro 3520", cost: 52400, ageDays: 980, vendor: "Dell", status: "UNDER_REPAIR", specs: { cpu: "Intel Core i5-1235U", ram: "8 GB", storage: "512 GB SSD" }, condition: "POOR" },
    { prefix: "LAP", name: "Lenovo IdeaPad Slim 3", brand: "Lenovo", model: "IdeaPad Slim 3", cost: 49900, ageDays: 60, vendor: "Lenovo", status: "IN_STOCK", condition: "NEW", specs: { cpu: "Intel Core i5-12450H", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "Lenovo IdeaPad Slim 3", brand: "Lenovo", model: "IdeaPad Slim 3", cost: 49900, ageDays: 60, vendor: "Lenovo", holder: "Kavya Menon", specs: { cpu: "Intel Core i5-12450H", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "LAP", name: "HP 250 G9", brand: "HP", model: "250 G9", cost: 41500, ageDays: 1300, vendor: "HP", status: "RETIRED", condition: "POOR" },
    { prefix: "DSK", name: "Dell OptiPlex 7010 Tower", brand: "Dell", model: "OptiPlex 7010", cost: 58900, ageDays: 510, vendor: "Dell", holder: "Suresh Pillai", specs: { cpu: "Intel Core i5-13500", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "DSK", name: "Dell OptiPlex 7010 Tower", brand: "Dell", model: "OptiPlex 7010", cost: 58900, ageDays: 510, vendor: "Dell", holder: "Manoj Yadav", specs: { cpu: "Intel Core i5-13500", ram: "16 GB", storage: "512 GB SSD" } },
    { prefix: "DSK", name: "HP ProDesk 400 G9", brand: "HP", model: "ProDesk 400 G9", cost: 52300, ageDays: 760, vendor: "HP", status: "IN_STOCK", condition: "GOOD" },
    { prefix: "MON", name: 'Dell 24" P2423H Monitor', brand: "Dell", model: "P2423H", cost: 15800, ageDays: 420, vendor: "Dell", holder: "Aarav Sharma" },
    { prefix: "MON", name: 'Dell 24" P2423H Monitor', brand: "Dell", model: "P2423H", cost: 15800, ageDays: 420, vendor: "Dell", holder: "Vikram Singh" },
    { prefix: "MON", name: 'LG 27" 27UL500 4K Monitor', brand: "LG", model: "27UL500", cost: 24500, ageDays: 300, vendor: "Croma", holder: "Meera Nair" },
    { prefix: "MON", name: 'Samsung 24" LF24T350 Monitor', brand: "Samsung", model: "LF24T350", cost: 10900, ageDays: 200, vendor: "Croma", status: "IN_STOCK", condition: "GOOD" },
    { prefix: "MON", name: 'Samsung 24" LF24T350 Monitor', brand: "Samsung", model: "LF24T350", cost: 10900, ageDays: 200, vendor: "Croma", status: "IN_STOCK", condition: "NEW" },
    { prefix: "PRN", name: "HP LaserJet Pro MFP M428fdw", brand: "HP", model: "M428fdw", cost: 46500, ageDays: 900, vendor: "HP", status: "IN_STOCK", location: puneF4, condition: "GOOD" },
    { prefix: "PRN", name: "Canon imageCLASS MF244dw", brand: "Canon", model: "MF244dw", cost: 22900, ageDays: 1100, vendor: "Croma", status: "UNDER_REPAIR", location: puneF3, condition: "FAIR" },
    { prefix: "NET", name: "Cisco CBS350-24P Switch", brand: "Cisco", model: "CBS350-24P-4G", cost: 61200, ageDays: 1000, vendor: "Ingram", status: "IN_STOCK", location: serverRoom },
    { prefix: "NET", name: "Fortinet FortiGate 40F Firewall", brand: "Fortinet", model: "FG-40F", cost: 54800, ageDays: 700, vendor: "Ingram", status: "IN_STOCK", location: serverRoom },
    { prefix: "WAP", name: "TP-Link Omada EAP670 AP", brand: "TP-Link", model: "EAP670", cost: 12800, ageDays: 650, vendor: "Ingram", status: "IN_STOCK", location: puneF3 },
    { prefix: "WAP", name: "TP-Link Omada EAP670 AP", brand: "TP-Link", model: "EAP670", cost: 12800, ageDays: 650, vendor: "Ingram", status: "IN_STOCK", location: puneF4 },
    { prefix: "PHN", name: "Samsung Galaxy A35 5G", brand: "Samsung", model: "Galaxy A35", cost: 30999, ageDays: 240, vendor: "Croma", holder: "Ishita Banerjee" },
    { prefix: "TAB", name: "Apple iPad 10th Gen", brand: "Apple", model: "iPad (10th gen)", cost: 39900, ageDays: 380, vendor: "Croma", holder: "Rajesh Agarwal" },
    { prefix: "UPS", name: "APC Smart-UPS 1500VA", brand: "APC", model: "SMT1500IC", cost: 48600, ageDays: 1150, vendor: "PowerSafe", status: "IN_STOCK", location: serverRoom },
    { prefix: "SRV", name: "Dell PowerEdge T150 File Server", brand: "Dell", model: "PowerEdge T150", cost: 145000, ageDays: 820, vendor: "Dell", status: "IN_STOCK", location: serverRoom, specs: { cpu: "Intel Xeon E-2314", ram: "32 GB ECC", storage: "2 × 2 TB HDD (RAID 1)" } },
  ];

  const seqByPrefix: Record<string, number> = {};
  const assets: { id: string; tag: string; holderId: string | null; cost: number; purchaseDate: Date; name: string; vendorId: string }[] = [];
  for (const a of assetSeeds) {
    const type = typeByPrefix(a.prefix);
    const seq = (seqByPrefix[a.prefix] = (seqByPrefix[a.prefix] ?? 0) + 1);
    const tag = `${a.prefix}-${String(seq).padStart(4, "0")}`;
    const purchaseDate = daysFromToday(-a.ageDays);
    const holder = a.holder ? emp(a.holder) : null;
    const warrantyYears = a.warrantyYears ?? (a.prefix === "LAP" || a.prefix === "DSK" ? 1 : 2);
    const created = await db.asset.create({
      data: {
        assetTag: tag,
        name: a.name,
        typeId: type.id,
        brand: a.brand,
        model: a.model,
        serialNumber: `${a.brand.slice(0, 2).toUpperCase()}${Math.floor(rand() * 1e9).toString(36).toUpperCase().padStart(7, "X")}`,
        specs: a.specs,
        purchaseDate,
        purchaseCost: money(a.cost),
        vendorId: vendor(a.vendor),
        invoiceNumber: `INV/${purchaseDate.getUTCFullYear()}/${Math.floor(1000 + rand() * 9000)}`,
        warrantyStart: purchaseDate,
        warrantyEnd: addMonths(purchaseDate, warrantyYears * 12),
        locationId: (a.location ?? (holder ? locs.find((l) => l.id === holder.locationId) : puneF3))?.id,
        departmentId: holder?.departmentId ?? null,
        condition: a.condition ?? (a.ageDays < 120 ? "NEW" : "GOOD"),
        status: holder ? "ASSIGNED" : (a.status ?? "IN_STOCK"),
        currentHolderId: holder?.id ?? null,
      },
    });
    assets.push({ id: created.id, tag, holderId: holder?.id ?? null, cost: a.cost, purchaseDate, name: a.name, vendorId: vendor(a.vendor) });
  }
  for (const t of types) {
    await db.assetType.update({ where: { id: t.id }, data: { nextSequence: (seqByPrefix[t.prefix] ?? 0) + 1 } });
  }

  // Assignment history: current holders + some past holders
  const accessoriesFor = (tag: string) => (tag.startsWith("LAP") ? ["Charger", "Laptop bag"] : tag.startsWith("PHN") || tag.startsWith("TAB") ? ["Charger", "Cover"] : []);
  for (const a of assets) {
    if (a.holderId) {
      const exHolder = rand() < 0.35 ? pick(employees.filter((e) => e.id !== a.holderId)) : null;
      let issued = new Date(a.purchaseDate.getTime() + 2 * DAY);
      if (exHolder) {
        const returned = new Date(issued.getTime() + Math.round(90 + rand() * 120) * DAY);
        await db.assetAssignment.create({
          data: {
            assetId: a.id, employeeId: exHolder.id, issuedAt: issued, returnedAt: returned, conditionAtIssue: "NEW", conditionAtReturn: "GOOD",
            accessories: accessoriesFor(a.tag), issueNotes: "Issued at onboarding", returnNotes: "Returned on role change", issuedById: admin.id, receivedById: admin.id,
          },
        });
        issued = new Date(returned.getTime() + 3 * DAY);
      }
      await db.assetAssignment.create({
        data: {
          assetId: a.id, employeeId: a.holderId, issuedAt: issued, conditionAtIssue: exHolder ? "GOOD" : "NEW",
          expectedReturnAt: a.tag === "LAP-0008" ? daysFromToday(12) : null,
          accessories: accessoriesFor(a.tag), issueNotes: exHolder ? "Reissued after refurbishment" : "Issued at onboarding", issuedById: admin.id,
        },
      });
    }
  }
  // The exited employee returned their laptop
  const exited = emp("Harsh Vardhan");
  const stockLaptop = assets.find((a) => a.tag === "LAP-0010")!;
  await db.assetAssignment.create({
    data: {
      assetId: stockLaptop.id, employeeId: exited.id, issuedAt: daysFromToday(-55), returnedAt: daysFromToday(-40),
      conditionAtIssue: "NEW", conditionAtReturn: "GOOD", accessories: ["Charger"], issueNotes: "Interim laptop", returnNotes: "Returned at exit", issuedById: admin.id, receivedById: admin.id,
    },
  });

  // Asset purchase expenses (last 13 months only, to keep the 12-month chart meaningful)
  for (const a of assets) {
    if (a.purchaseDate < daysFromToday(-395)) continue;
    await db.expense.create({
      data: {
        date: a.purchaseDate, categoryId: cat("Hardware"), description: `Purchase · ${a.tag} ${a.name}`, ...gstSplit(a.cost),
        vendorId: a.vendorId, paymentMode: "BANK_TRANSFER", transactionRef: `NEFT${Math.floor(rand() * 1e10)}`, paidBy: "Accounts", source: "ASSET_PURCHASE", assetId: a.id,
      },
    });
  }

  // Subscriptions + payment history (each payment auto-created an expense)
  type SubSeed = {
    name: string; category: string; vendor: string; accountId: string; plan: string; amount: number; cycle: BillingCycle;
    customDays?: number; dueIn: number; history: number; mode: PaymentMode; autoRenew?: boolean; location?: typeof puneF3; dept?: string; loginUrl?: string; status?: "ACTIVE" | "PAUSED" | "CANCELLED";
    variance?: number;
  };
  const subSeeds: SubSeed[] = [
    { name: "Airtel Xstream Fiber · Pune HQ", category: "ISP", vendor: "Bharti Airtel", accountId: "AIR-20458812", plan: "Business 300 Mbps unlimited, static IP", amount: 2359, cycle: "MONTHLY", dueIn: 3, history: 12, mode: "UPI", location: puneF3, loginUrl: "https://www.airtel.in/business/" },
    { name: "JioFiber Backup Line · Pune HQ", category: "ISP", vendor: "Reliance Jio", accountId: "JIO-81200473", plan: "150 Mbps business backup", amount: 1178, cycle: "MONTHLY", dueIn: -4, history: 12, mode: "UPI", location: puneF4, loginUrl: "https://www.jio.com/selfcare/" },
    { name: "AWS · Production (EC2 + EBS + S3)", category: "CLOUD", vendor: "Amazon Web Services", accountId: "4471-2290-8813", plan: "ap-south-1 · t3.large ×2, 500 GB EBS", amount: 18450, cycle: "MONTHLY", dueIn: 6, history: 12, mode: "CARD", dept: "ENG", loginUrl: "https://console.aws.amazon.com", variance: 0.12, autoRenew: true },
    { name: "Microsoft 365 Business Standard", category: "SOFTWARE", vendor: "Microsoft", accountId: "northwind.onmicrosoft.com", plan: "25 seats × ₹770", amount: 19250, cycle: "MONTHLY", dueIn: 12, history: 12, mode: "CARD", autoRenew: true, loginUrl: "https://admin.microsoft.com" },
    { name: "Vi Business Postpaid SIMs", category: "PHONE", vendor: "Vodafone Idea", accountId: "VI-BIZ-772019", plan: "6 SIMs · RED Business 499", amount: 3540, cycle: "MONTHLY", dueIn: 18, history: 12, mode: "BANK_TRANSFER", dept: "SAL" },
    { name: "Hostinger VPS · Staging", category: "CLOUD", vendor: "Hostinger", accountId: "HST-559201", plan: "KVM 4 · 4 vCPU / 16 GB", amount: 8999, cycle: "YEARLY", dueIn: 26, history: 1, mode: "CARD", dept: "ENG", loginUrl: "https://hpanel.hostinger.com" },
    { name: "northwind.in domain", category: "DOMAIN", vendor: "GoDaddy", accountId: "GD-93811023", plan: ".in domain + privacy", amount: 1499, cycle: "YEARLY", dueIn: 44, history: 1, mode: "CARD", autoRenew: true, loginUrl: "https://dcc.godaddy.com" },
    { name: "Wildcard SSL · *.northwind.in", category: "SSL", vendor: "GoDaddy", accountId: "GD-SSL-44120", plan: "Wildcard DV SSL", amount: 7800, cycle: "YEARLY", dueIn: 71, history: 1, mode: "CARD" },
    { name: "Quick Heal Total Security (25 users)", category: "SOFTWARE", vendor: "Quick Heal", accountId: "QH-ENT-30871", plan: "Endpoint security · 25 devices", amount: 32000, cycle: "YEARLY", dueIn: 140, history: 1, mode: "BANK_TRANSFER" },
    { name: "UPS AMC · Server Room", category: "AMC", vendor: "PowerSafe", accountId: "AMC-PS-2291", plan: "Quarterly preventive visits + battery check", amount: 3000, cycle: "QUARTERLY", dueIn: 33, history: 4, mode: "BANK_TRANSFER", location: serverRoom },
    { name: "Zoom Pro (Sales)", category: "SOFTWARE", vendor: "Croma", accountId: "zoom-sales", plan: "Cancelled — moved to Teams", amount: 1300, cycle: "MONTHLY", dueIn: -60, history: 3, mode: "CARD", status: "CANCELLED", dept: "SAL" },
  ];

  const createdSubs: { id: string; name: string; vendorId: string; amount: number }[] = [];
  for (const s of subSeeds) {
    const nextDue = daysFromToday(s.dueIn);
    const step = (d: Date, n: number) => (s.cycle === "CUSTOM" ? new Date(d.getTime() + n * (s.customDays ?? 30) * DAY) : addMonths(d, n * cycleMonths[s.cycle]));
    const startDate = step(nextDue, -(s.history + (s.status === "CANCELLED" ? 0 : 0)));
    const sub = await db.subscription.create({
      data: {
        name: s.name, category: s.category, vendorId: vendor(s.vendor), accountId: s.accountId, planDetails: s.plan, amount: money(s.amount),
        billingCycle: s.cycle, customCycleDays: s.customDays, startDate, nextDueDate: nextDue, autoRenew: s.autoRenew ?? false, paymentMode: s.mode,
        locationId: s.location?.id, departmentId: s.dept ? dept(s.dept) : null, loginUrl: s.loginUrl, status: s.status ?? "ACTIVE",
        notes: s.category === "ISP" ? "Static IP configured on FortiGate WAN port." : null,
      },
    });
    createdSubs.push({ id: sub.id, name: s.name, vendorId: vendor(s.vendor), amount: s.amount });

    // Paid periods: [start + k cycles, start + (k+1) cycles) for k < history. The overdue one isn't paid yet.
    for (let k = 0; k < s.history; k++) {
      const periodStart = step(startDate, k);
      const periodEnd = new Date(step(startDate, k + 1).getTime() - DAY);
      const paidAt = new Date(periodStart.getTime() - Math.round(rand() * 3) * DAY);
      if (paidAt > istToday) continue;
      const total = Math.round(s.amount * (1 + (s.variance ? (rand() - 0.5) * 2 * s.variance : 0)));
      const expense = await db.expense.create({
        data: {
          date: paidAt, categoryId: cat("Subscriptions"), description: `${s.name} · ${periodStart.toISOString().slice(0, 7)}`, ...gstSplit(total),
          vendorId: vendor(s.vendor), paymentMode: s.mode, transactionRef: s.mode === "UPI" ? `UPI${Math.floor(rand() * 1e12)}` : `TXN${Math.floor(rand() * 1e9)}`,
          paidBy: "Admin", source: "SUBSCRIPTION", subscriptionId: sub.id,
        },
      });
      await db.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id, paidAt, amount: money(total), paymentMode: s.mode, transactionRef: expense.transactionRef, periodStart, periodEnd,
          expenseId: expense.id, createdById: admin.id,
        },
      });
    }
  }

  // Other expenses: repairs, consumables, services, misc across the last 12 months
  const misc: [string, string, number, string | null, PaymentMode][] = [
    ["Consumables", "Cat6 patch cables (50) + RJ45 connectors", 4600, "Sai Stationery", "UPI"],
    ["Consumables", "Canon 337 toner × 2", 7200, "Sai Stationery", "CASH"],
    ["Services", "Structured cabling · Floor 4 expansion (12 points)", 28500, null, "BANK_TRANSFER"],
    ["Services", "Data recovery from failed HDD", 12000, "TechCare", "UPI"],
    ["Services", "CCTV NVR configuration visit", 3500, null, "UPI"],
    ["Miscellaneous", "Courier · laptop to Bengaluru office", 850, null, "UPI"],
    ["Miscellaneous", "Cable management trays", 2400, "Sai Stationery", "CASH"],
  ];
  for (const [category, description, total, vend, mode] of misc) {
    await db.expense.create({
      data: {
        date: daysFromToday(-Math.round(5 + rand() * 350)), categoryId: cat(category), description, ...gstSplit(total),
        vendorId: vend ? vendor(vend) : null, paymentMode: mode, transactionRef: mode === "CASH" ? null : `REF${Math.floor(rand() * 1e9)}`, paidBy: pick(["Admin", "Sneha Pawar", "Accounts"]),
        source: "MANUAL",
      },
    });
  }

  // Documents with real (generated) PDF files
  const airtel = createdSubs[0];
  const airtelPayment = await db.subscriptionPayment.findFirst({ where: { subscriptionId: airtel.id }, orderBy: { paidAt: "desc" } });
  const docs: { title: string; type: "INVOICE" | "WARRANTY_CARD" | "CONTRACT"; invoiceNumber?: string; date: Date; vendorId: string; amount?: number; link: Partial<Record<"assetId" | "subscriptionId" | "expenseId", string>>; lines: string[] }[] = [
    {
      title: "Airtel Xstream Fiber invoice", type: "INVOICE", invoiceNumber: "AIRTEL/MH/24-25/889120", date: airtelPayment?.paidAt ?? istToday, vendorId: airtel.vendorId, amount: airtel.amount,
      link: { subscriptionId: airtel.id, expenseId: airtelPayment?.expenseId ?? undefined },
      lines: ["Bharti Airtel Ltd - Tax Invoice", "Invoice no: AIRTEL/MH/24-25/889120", "Customer: Northwind Technologies Pvt Ltd", "Plan: Business 300 Mbps", `Amount payable: INR ${airtel.amount.toFixed(2)} (incl. GST)`],
    },
    {
      title: "Dell Latitude 5440 × 2 purchase invoice", type: "INVOICE", invoiceNumber: "DELL/IN/2025/774410", date: assets[0].purchaseDate, vendorId: assets[0].vendorId, amount: 157000,
      link: { assetId: assets[0].id },
      lines: ["Dell Technologies India - Tax Invoice", "Invoice no: DELL/IN/2025/774410", "2 x Latitude 5440 (i7-1355U, 16GB, 512GB)", "Total: INR 1,57,000.00 (incl. GST)"],
    },
    {
      title: "Dell ProSupport warranty certificate", type: "WARRANTY_CARD", date: assets[0].purchaseDate, vendorId: assets[0].vendorId,
      link: { assetId: assets[0].id },
      lines: ["Dell ProSupport - Warranty Certificate", `Service tag: ${assets[0].tag}`, "Coverage: 3 years onsite, next business day"],
    },
    {
      title: "UPS AMC contract 2026", type: "CONTRACT", date: daysFromToday(-120), vendorId: vendor("PowerSafe"), amount: 12000,
      link: { subscriptionId: createdSubs.find((s) => s.name.startsWith("UPS AMC"))!.id },
      lines: ["PowerSafe UPS Solutions - Annual Maintenance Contract", "Equipment: APC Smart-UPS 1500VA (Server Room)", "4 preventive visits per year, battery health check"],
    },
  ];
  for (const d of docs) {
    const file = await storePdf(d.lines);
    await db.document.create({
      data: {
        type: d.type, title: d.title, ...file, fileName: `${d.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`, invoiceNumber: d.invoiceNumber ?? null,
        invoiceDate: d.date, vendorId: d.vendorId, amount: d.amount ? money(d.amount) : null, uploadedById: admin.id, ...d.link,
      },
    });
  }

  // Tickets
  const ticketSeeds: [string, string, string, TicketPriority, TicketStatus, TicketSource, number][] = [
    ["Laptop not charging", "Aarav Sharma", "Hardware", "HIGH", "OPEN", "WALK_IN", 1],
    ["Outlook keeps asking for password", "Neha Gupta", "Email", "MEDIUM", "IN_PROGRESS", "PHONE", 2],
    ["WiFi drops in Conference Room B", "Pooja Mehta", "Network/WiFi", "HIGH", "WAITING_ON_VENDOR", "SELF_IDENTIFIED", 5],
    ["Need access to finance shared drive", "Suresh Pillai", "Access/Account", "LOW", "RESOLVED", "EMAIL", 9],
    ["Printer on Floor 3 jamming", "Rohan Kulkarni", "Printer", "MEDIUM", "WAITING_ON_VENDOR", "WALK_IN", 6],
    ["Install Figma desktop app", "Meera Nair", "Software", "LOW", "CLOSED", "WHATSAPP", 20],
    ["AWS EC2 data volume at 85%", "Vikram Singh", "Server/Cloud", "CRITICAL", "IN_PROGRESS", "SELF_IDENTIFIED", 1],
    ["New joiner laptop setup — Sales", "Amit Patil", "Hardware", "MEDIUM", "OPEN", "EMAIL", 0],
    ["VPN not connecting from home", "Sneha Joshi", "Network/WiFi", "HIGH", "WAITING_ON_USER", "WHATSAPP", 3],
    ["Teams calls choppy", "Ishita Banerjee", "Network/WiFi", "MEDIUM", "RESOLVED", "PHONE", 14],
    ["Reset MFA for M365", "Karthik Reddy", "Access/Account", "HIGH", "CLOSED", "PHONE", 25],
    ["Monitor flickering", "Vikram Singh", "Hardware", "LOW", "OPEN", "WALK_IN", 4],
    ["Shared mailbox for support@", "Ishita Banerjee", "Email", "MEDIUM", "RESOLVED", "EMAIL", 30],
    ["Excel crashes on large files", "Kavya Menon", "Software", "MEDIUM", "IN_PROGRESS", "WALK_IN", 2],
    ["Offboarding — Harsh Vardhan", "Divya Kapoor", "Access/Account", "MEDIUM", "CLOSED", "EMAIL", 41],
    ["Phone not syncing email", "Ishita Banerjee", "Email", "LOW", "OPEN", "WHATSAPP", 1],
    ["Server room AC alarm", "Siddharth Kulkarni", "Other", "CRITICAL", "RESOLVED", "PHONE", 60],
    ["Quick Heal license expired on 2 PCs", "Manoj Yadav", "Software", "HIGH", "RESOLVED", "SELF_IDENTIFIED", 75],
    ["Request second monitor", "Ananya Iyer", "Hardware", "LOW", "WAITING_ON_USER", "EMAIL", 7],
    ["Monthly backup verification", "Rajesh Agarwal", "Server/Cloud", "MEDIUM", "OPEN", "SELF_IDENTIFIED", 0],
  ];
  const assetByTag = (tag: string) => assets.find((a) => a.tag === tag)!.id;
  const ticketAsset: Record<string, string> = {
    "Laptop not charging": assetByTag("LAP-0001"),
    "Printer on Floor 3 jamming": assetByTag("PRN-0002"),
    "Monitor flickering": assetByTag("MON-0002"),
    "Request second monitor": assetByTag("MON-0004"),
  };
  const resolutions: Record<string, string> = {
    "Need access to finance shared drive": "Added Suresh to the Finance-RW group on the file server; he confirmed access.",
    "Install Figma desktop app": "Installed Figma desktop and signed in with the team licence.",
    "Teams calls choppy": "Moved the AP on Floor 4 to channel 44 and enabled band steering. Calls stable since.",
    "Reset MFA for M365": "Reset MFA in the M365 admin centre and re-enrolled Authenticator on the new phone.",
    "Shared mailbox for support@": "Created support@ shared mailbox and granted the support team Send As.",
    "Offboarding — Harsh Vardhan": "Disabled M365 account, converted mailbox to shared, collected LAP-0010.",
    "Server room AC alarm": "AC compressor tripped; electrician reset it and PowerSafe checked the UPS load.",
    "Quick Heal license expired on 2 PCs": "Renewed the 2 seats under the annual licence and pushed the update.",
  };
  const tickets: { id: string; title: string; status: TicketStatus; createdAt: Date; resolvedAt: Date | null }[] = [];
  for (const [i, [title, requester, category, priority, status, source, age]] of ticketSeeds.entries()) {
    const createdAt = new Date(Date.now() - age * DAY - Math.round(rand() * 6) * 3_600_000);
    const done = status === "RESOLVED" || status === "CLOSED";
    const resolvedAt = done ? new Date(createdAt.getTime() + Math.round(2 + rand() * 40) * 3_600_000) : null;
    const t = await db.ticket.create({
      data: {
        ticketNumber: `TKT-${String(i + 1).padStart(4, "0")}`, title, requesterId: emp(requester).id, categoryId: tcat(category), priority, status, source,
        assetId: ticketAsset[title] ?? null,
        createdAt, dueDate: done ? null : new Date(createdAt.getTime() + (priority === "CRITICAL" ? 1 : priority === "HIGH" ? 2 : 5) * DAY),
        resolvedAt,
        closedAt: status === "CLOSED" ? new Date(createdAt.getTime() + 3 * DAY) : null,
        timeSpentMinutes: done ? Math.round(15 + rand() * 120) : status === "OPEN" ? 0 : Math.round(10 + rand() * 50), assigneeId: admin.id, createdById: admin.id,
        resolutionNotes: done ? (resolutions[title] ?? "Resolved and confirmed with the requester.") : null,
      },
    });
    tickets.push({ id: t.id, title, status, createdAt, resolvedAt });
  }
  // Timelines: created → (in progress) → (waiting/resolved), plus a few comments.
  const comments: Record<string, string[]> = {
    "Laptop not charging": ["Tried a spare charger — same issue. Likely the DC jack.", "Dell ProSupport case opened: SR 1189023."],
    "WiFi drops in Conference Room B": ["Airtel says the line is fine; looks like AP interference. TP-Link support ticket raised."],
    "Printer on Floor 3 jamming": ["Fuser looks worn. Sent to TechCare for service."],
    "AWS EC2 data volume at 85%": ["Cleared 40 GB of old logs; still need to resize the EBS volume to 750 GB."],
    "VPN not connecting from home": ["Asked Sneha to update FortiClient to 7.2 — waiting for her to try."],
  };
  for (const t of tickets) {
    const at = (h: number) => new Date(t.createdAt.getTime() + h * 3_600_000);
    const events: { kind: "SYSTEM" | "STATUS_CHANGE" | "COMMENT"; body: string; meta?: object; createdAt: Date }[] = [{ kind: "SYSTEM", body: "Ticket created", createdAt: t.createdAt }];
    if (t.status !== "OPEN") events.push({ kind: "STATUS_CHANGE", body: "Status changed", meta: { from: "OPEN", to: "IN_PROGRESS" }, createdAt: at(0.5) });
    (comments[t.title] ?? []).forEach((body, i) => events.push({ kind: "COMMENT", body, createdAt: at(1 + i * 3) }));
    if (t.status === "WAITING_ON_USER" || t.status === "WAITING_ON_VENDOR") events.push({ kind: "STATUS_CHANGE", body: "Status changed", meta: { from: "IN_PROGRESS", to: t.status }, createdAt: at(8) });
    if (t.resolvedAt) events.push({ kind: "STATUS_CHANGE", body: "Status changed", meta: { from: "IN_PROGRESS", to: "RESOLVED" }, createdAt: t.resolvedAt });
    if (t.status === "CLOSED") events.push({ kind: "STATUS_CHANGE", body: "Status changed", meta: { from: "RESOLVED", to: "CLOSED" }, createdAt: new Date(t.createdAt.getTime() + 3 * DAY) });
    await db.ticketComment.createMany({ data: events.map((e) => ({ ticketId: t.id, authorId: e.kind === "SYSTEM" ? null : admin.id, ...e })) });
  }

  // Maintenance: two repairs in progress (one overdue) + closed history. Each cost → a linked expense.
  const repairCat = cat("Repairs & Maintenance");
  const repairs: { tag: string; issue: string; vendor: string; sent: number; expected: number | null; returned: number | null; cost: number | null; warranty: boolean; outcome?: string; ticket?: string; previous: AssetStatus }[] = [
    { tag: "LAP-0009", issue: "Display flickering and hinge cracked", vendor: "TechCare", sent: -6, expected: 2, returned: null, cost: 9200, warranty: false, previous: "IN_STOCK" },
    { tag: "PRN-0002", issue: "Paper jams; fuser unit worn", vendor: "TechCare", sent: -10, expected: -3, returned: null, cost: null, warranty: false, ticket: "Printer on Floor 3 jamming", previous: "IN_STOCK" },
    { tag: "LAP-0006", issue: "Keyboard keys not responding", vendor: "TechCare", sent: -130, expected: -125, returned: -124, cost: 2900, warranty: false, outcome: "Keyboard replaced.", previous: "ASSIGNED" },
    { tag: "UPS-0001", issue: "Battery backup under 5 minutes", vendor: "PowerSafe", sent: -205, expected: -200, returned: -201, cost: 14800, warranty: false, outcome: "Replaced 4 × 12V 9Ah batteries; backup back to 25 min.", previous: "IN_STOCK" },
    { tag: "LAP-0001", issue: "Battery swelling", vendor: "Dell", sent: -240, expected: -233, returned: -234, cost: null, warranty: true, outcome: "Battery replaced under ProSupport warranty.", previous: "ASSIGNED" },
  ];
  for (const r of repairs) {
    const asset = assets.find((a) => a.tag === r.tag)!;
    const ticketId = r.ticket ? tickets.find((t) => t.title === r.ticket)?.id ?? null : null;
    const m = await db.maintenanceRecord.create({
      data: {
        assetId: asset.id, issue: r.issue, sentAt: daysFromToday(r.sent), vendorId: vendor(r.vendor), expectedReturnAt: r.expected === null ? null : daysFromToday(r.expected),
        returnedAt: r.returned === null ? null : daysFromToday(r.returned), cost: r.cost === null ? null : money(r.cost), underWarranty: r.warranty,
        status: r.returned === null ? "OPEN" : "CLOSED", previousAssetStatus: r.previous, outcome: r.outcome ?? null, ticketId,
      },
    });
    if (r.cost) {
      await db.expense.create({
        data: {
          date: daysFromToday(r.returned ?? r.sent), categoryId: repairCat, description: `Repair · ${r.tag} · ${r.issue}`, amount: money(r.cost), taxAmount: money(0), total: money(r.cost),
          vendorId: vendor(r.vendor), paymentMode: "UPI", paidBy: "Admin", source: "MAINTENANCE", maintenanceId: m.id, assetId: asset.id, ticketId,
        },
      });
    }
    if (ticketId) await db.ticketComment.create({ data: { ticketId, authorId: admin.id, kind: "SYSTEM", body: `${r.tag} sent for repair to TechCare Service Centre`, createdAt: daysFromToday(r.sent) } });
  }

  // Inventory: opening stock, purchases (each with its Consumables expense) and issues to staff.
  const consumablesCat = cat("Consumables");
  type ItemSeed = { name: string; category: string; sku: string; unit?: string; final: number; min: number; cost: number; vendor: string;
    buys?: { daysAgo: number; qty: number; invoice: string; mode: PaymentMode }[]; issues: { daysAgo: number; qty: number; to: string; ticket?: string; note?: string }[] };
  const itemSeeds: ItemSeed[] = [
    { name: "Logitech M90 USB Mouse", category: "Mouse", sku: "ACC-MOU-M90", final: 4, min: 5, cost: 399, vendor: "Croma",
      buys: [{ daysAgo: 95, qty: 10, invoice: "CRM/B2B/88213", mode: "CARD" }],
      issues: [{ daysAgo: 80, qty: 1, to: "Rohan Kulkarni" }, { daysAgo: 61, qty: 2, to: "Amit Patil", note: "Sales team spares" }, { daysAgo: 30, qty: 1, to: "Ananya Iyer" }, { daysAgo: 12, qty: 1, to: "Neha Gupta" }, { daysAgo: 3, qty: 1, to: "Manoj Yadav", note: "Scroll wheel broken" }] },
    { name: "Logitech K120 Keyboard", category: "Keyboard", sku: "ACC-KBD-K120", final: 6, min: 3, cost: 549, vendor: "Croma", issues: [{ daysAgo: 70, qty: 1, to: "Suresh Pillai" }, { daysAgo: 22, qty: 1, to: "Kavya Menon" }] },
    { name: "Cat6 Patch Cable 2m", category: "Cable", sku: "CBL-CAT6-2M", final: 38, min: 20, cost: 85, vendor: "Sai Stationery",
      issues: [{ daysAgo: 88, qty: 6, to: "Siddharth Kulkarni", note: "Floor 4 desk setup" }, { daysAgo: 40, qty: 4, to: "Ishita Banerjee" }, { daysAgo: 9, qty: 2, to: "Pooja Mehta", ticket: "WiFi drops in Conference Room B" }] },
    { name: "HP 26A Toner", category: "Toner", sku: "TNR-HP-26A", final: 1, min: 2, cost: 5950, vendor: "Sai Stationery",
      buys: [{ daysAgo: 75, qty: 3, invoice: "SSC/2026/0412", mode: "UPI" }],
      issues: [{ daysAgo: 70, qty: 1, to: "Siddharth Kulkarni", note: "Floor 4 LaserJet" }, { daysAgo: 35, qty: 1, to: "Siddharth Kulkarni", note: "Floor 4 LaserJet" }, { daysAgo: 6, qty: 1, to: "Rohan Kulkarni", ticket: "Printer on Floor 3 jamming" }] },
    { name: "USB-C 65W Charger", category: "Charger", sku: "CHG-USBC-65", final: 3, min: 2, cost: 1990, vendor: "Croma",
      buys: [{ daysAgo: 50, qty: 4, invoice: "CRM/B2B/90117", mode: "CARD" }],
      issues: [{ daysAgo: 1, qty: 1, to: "Aarav Sharma", ticket: "Laptop not charging", note: "Loaner while Dell replaces the DC jack" }] },
    { name: "8 GB DDR4 SODIMM", category: "RAM", sku: "RAM-DDR4-8G", final: 2, min: 2, cost: 1650, vendor: "Ingram", issues: [{ daysAgo: 55, qty: 2, to: "Neha Gupta", note: "ProBook upgrade to 16 GB" }] },
    { name: "HDMI to USB-C Adapter", category: "Adapter", sku: "ADP-HDMI-USBC", final: 7, min: 3, cost: 899, vendor: "Croma", issues: [{ daysAgo: 25, qty: 1, to: "Meera Nair" }] },
  ];
  for (const it of itemSeeds) {
    const item = await db.inventoryItem.create({
      data: { name: it.name, category: it.category, sku: it.sku, unit: it.unit ?? "pcs", quantity: it.final, minQuantity: it.min, unitCost: money(it.cost), locationId: puneF4.id, vendorId: vendor(it.vendor) },
    });
    const bought = (it.buys ?? []).reduce((s, b) => s + b.qty, 0);
    const issued = it.issues.reduce((s, i) => s + i.qty, 0);
    const events = [
      ...(it.buys ?? []).map((b) => ({ kind: "in" as const, daysAgo: b.daysAgo, qty: b.qty, b })),
      ...it.issues.map((i) => ({ kind: "out" as const, daysAgo: i.daysAgo, qty: i.qty, i })),
    ].sort((a, b) => b.daysAgo - a.daysAgo);
    let running = it.final + issued - bought;
    await db.stockMovement.create({ data: { itemId: item.id, type: "ADJUSTMENT", quantityChange: running, quantityAfter: running, notes: "Opening stock", occurredAt: daysFromToday(-150), createdById: admin.id } });
    for (const e of events) {
      const when = new Date(daysFromToday(-e.daysAgo).getTime() + 6 * 3_600_000);
      if (e.kind === "in") {
        running += e.qty;
        await db.stockMovement.create({ data: { itemId: item.id, type: "STOCK_IN", quantityChange: e.qty, quantityAfter: running, unitCost: money(it.cost), invoiceNumber: e.b.invoice, occurredAt: when, createdById: admin.id } });
        await db.expense.create({
          data: { date: daysFromToday(-e.daysAgo), categoryId: consumablesCat, description: `Stock in · ${e.qty} × ${it.name}`, ...gstSplit(e.qty * it.cost), vendorId: vendor(it.vendor),
            paymentMode: e.b.mode, transactionRef: e.b.invoice, paidBy: "Admin", source: "STOCK_IN", inventoryItemId: item.id },
        });
      } else {
        running -= e.qty;
        const ticketId = e.i.ticket ? tickets.find((t) => t.title === e.i.ticket)?.id ?? null : null;
        await db.stockMovement.create({
          data: { itemId: item.id, type: "STOCK_OUT", quantityChange: -e.qty, quantityAfter: running, unitCost: money(it.cost), employeeId: emp(e.i.to).id, ticketId, notes: e.i.note ?? null, occurredAt: when, createdById: admin.id },
        });
        if (ticketId) await db.ticketComment.create({ data: { ticketId, authorId: admin.id, kind: "SYSTEM", body: `Used ${e.qty} × ${it.name} from stock (given to ${e.i.to})`, createdAt: when } });
      }
    }
  }

  // Licenses (keys encrypted the same way as src/lib/crypto.ts: AES-256-GCM, iv.tag.ciphertext in base64)
  const encKey = process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64 ? Buffer.from(process.env.ENCRYPTION_KEY, "hex") : null;
  const encrypt = (plain: string) => {
    if (!encKey) return null;
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", encKey, iv);
    const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
  };
  const subId = (prefix: string) => createdSubs.find((x) => x.name.startsWith(prefix))!.id;
  const licenseCat = cat("Software Licenses");
  type LicSeed = { name: string; type: "PER_USER" | "PER_DEVICE" | "SITE"; seats: number; vendor?: string; sub?: string; bought: number; expires: number | null; cost?: number; key?: string; holders?: string[]; devices?: string[]; past?: string[] };
  const activeStaff = employees.filter((e) => e.status !== "EXITED").map((e) => e.name);
  const licenseSeeds: LicSeed[] = [
    { name: "Microsoft 365 Business Standard", type: "PER_USER", seats: 25, vendor: "Microsoft", sub: "Microsoft 365", bought: -365, expires: null, holders: activeStaff.slice(0, 22), past: ["Harsh Vardhan"] },
    { name: "Quick Heal Total Security", type: "PER_DEVICE", seats: 25, vendor: "Quick Heal", sub: "Quick Heal", bought: -225, expires: 140, key: "QHTS-7Q2M-K9XD-44PL-ENT25",
      devices: assets.filter((a) => (a.tag.startsWith("LAP") || a.tag.startsWith("DSK")) && a.tag !== "LAP-0012").map((a) => a.tag) },
    { name: "Adobe Acrobat Pro", type: "PER_USER", seats: 2, bought: -200, expires: 165, cost: 31000, key: "1118-1932-7766-4421-0938-5512", holders: ["Kavya Menon", "Suresh Pillai"] },
    { name: "Figma Professional", type: "PER_USER", seats: 2, bought: -330, expires: 35, cost: 29800, holders: ["Meera Nair", "Sneha Joshi"] },
    { name: "Windows Server 2022 Standard", type: "PER_DEVICE", seats: 1, vendor: "Dell", bought: -820, expires: null, cost: 0, key: "VDYBN-27WPP-V4HQT-9VMD4-VMK7H", devices: ["SRV-0001"] },
  ];
  for (const l of licenseSeeds) {
    const lic = await db.license.create({
      data: {
        name: l.name, type: l.type, totalSeats: l.seats, vendorId: l.vendor ? vendor(l.vendor) : null, subscriptionId: l.sub ? subId(l.sub) : null,
        purchaseDate: daysFromToday(l.bought), expiryDate: l.expires === null ? null : daysFromToday(l.expires), cost: l.cost ? money(l.cost) : null,
        licenseKeyEnc: l.key ? encrypt(l.key) : null,
      },
    });
    if (l.cost) {
      await db.expense.create({
        data: { date: daysFromToday(l.bought), categoryId: licenseCat, description: `License · ${l.name} (${l.seats} seat${l.seats === 1 ? "" : "s"})`, ...gstSplit(l.cost), paymentMode: "CARD", paidBy: "Admin", source: "LICENSE", licenseId: lic.id },
      });
    }
    for (const [i, name] of (l.holders ?? []).entries()) {
      await db.licenseSeat.create({ data: { licenseId: lic.id, employeeId: emp(name).id, assignedAt: daysFromToday(l.bought + Math.min(i * 7, 300)) } });
    }
    for (const tag of l.devices ?? []) {
      await db.licenseSeat.create({ data: { licenseId: lic.id, assetId: assets.find((a) => a.tag === tag)!.id, assignedAt: daysFromToday(l.bought + 2) } });
    }
    for (const name of l.past ?? []) {
      await db.licenseSeat.create({ data: { licenseId: lic.id, employeeId: emp(name).id, assignedAt: daysFromToday(l.bought), revokedAt: daysFromToday(-40), notes: "Revoked at exit" } });
    }
  }

  // Custom reminders (times are IST: 09:30 IST = 04:00 UTC)
  const at = (days: number, utcHour: number) => new Date(daysFromToday(days).getTime() + utcHour * 3_600_000);
  const printer = assets.find((a) => a.tag === "PRN-0001")!;
  await db.reminder.createMany({
    data: [
      { type: "RECURRING_TASK", title: "Verify server & NAS backups", notes: "Check last night's backup job on the PowerEdge file server and test-restore one folder.", nextRunAt: at(Math.max(1, 32 - istToday.getUTCDate()), 4), repeatRule: "MONTHLY", createdById: admin.id, template: { requesterId: emp("Vikram Singh").id, categoryId: tcat("Server/Cloud"), priority: "MEDIUM" } },
      { type: "PREVENTIVE_MAINTENANCE", title: "Service HP LaserJet (Floor 4)", notes: "Clean rollers, check fuser, replace toner if under 20%.", nextRunAt: at(5, 4), repeatRule: "QUARTERLY", assetId: printer.id, createdById: admin.id },
      { type: "CUSTOM", title: "Rotate guest Wi-Fi password", notes: "Update the password on the FortiGate and the reception display.", nextRunAt: at(-1, 4), repeatRule: "MONTHLY", createdById: admin.id },
      { type: "CUSTOM", title: "Collect LAP-0008 from Siddharth (last day)", nextRunAt: at(12, 6), repeatRule: "NONE", createdById: admin.id },
    ],
  });

  // Accounts & logins
  const systemRows: { name: string; category: SystemCategory; loginUrl?: string; vendor?: string; steps?: string }[] = [
    { name: "Microsoft 365 (email)", category: "MICROSOFT", vendor: "Microsoft", loginUrl: "https://admin.microsoft.com", steps: "Admin centre → Users → Block sign-in and reset password. Convert the mailbox to shared and give the manager access, then remove the licence." },
    { name: "Slack", category: "COMMUNICATION", loginUrl: "https://northwind.slack.com/admin", steps: "Workspace admin → Members → Deactivate account." },
    { name: "FortiClient VPN", category: "VPN_NETWORK", loginUrl: "https://10.10.0.1", steps: "FortiGate → User & Authentication → User definition → disable the user." },
    { name: "GitHub", category: "DEV_TOOLS", loginUrl: "https://github.com/orgs/northwind/people", steps: "Org → People → Remove from organisation. Check for personal access tokens and deploy keys." },
    { name: "AWS Console", category: "CLOUD", vendor: "Amazon", loginUrl: "https://console.aws.amazon.com/iam", steps: "IAM → Users → delete console password and access keys, then delete the user." },
    { name: "Jira", category: "DEV_TOOLS", loginUrl: "https://northwind.atlassian.net", steps: "admin.atlassian.com → Directory → Users → Suspend access." },
    { name: "Zoho CRM", category: "SOFTWARE", loginUrl: "https://crm.zoho.in", steps: "Setup → Users → Deactivate. Transfer their leads and deals to the sales manager first." },
    { name: "Tally Prime", category: "FINANCE", steps: "Company → Security control → Users and passwords → remove the user." },
    { name: "HDFC NetBanking (corporate)", category: "FINANCE", loginUrl: "https://netbanking.hdfcbank.com", steps: "Ask the bank's RM in writing to deactivate the user ID; confirm by email." },
    { name: "Figma", category: "SOFTWARE", loginUrl: "https://www.figma.com/files/team", steps: "Admin → Members → Remove; transfer file ownership first." },
    { name: "Google Ads / Analytics", category: "GOOGLE", loginUrl: "https://ads.google.com", steps: "Tools → Access and security → remove the user. Repeat in Analytics → Admin → Account access." },
    { name: "LinkedIn company page", category: "SOCIAL", loginUrl: "https://www.linkedin.com/company/northwind/admin", steps: "Page admin → Settings → Manage admins → remove." },
  ];
  const systems = await Promise.all(
    systemRows.map((s) => db.appSystem.create({ data: { name: s.name, category: s.category, loginUrl: s.loginUrl ?? null, vendorId: s.vendor ? vendor(s.vendor) : null, offboardingSteps: s.steps ?? null } })),
  );
  const sys = (prefix: string) => systems.find((s) => s.name.startsWith(prefix))!.id;
  type AccSeed = { who: string; system: string; login?: string; access?: string; mfa?: boolean; personal?: boolean; password?: string; notes?: string; closed?: { status: "DISABLED" | "DELETED" | "TRANSFERRED"; note?: string } };
  const accountSeeds: AccSeed[] = [];
  const handle = (e: (typeof employees)[number]) => e.email!.split("@")[0];
  for (const e of employees) {
    const dep = people.find((p) => p[0] === e.name)![2];
    const exited = e.status === "EXITED";
    accountSeeds.push({ who: e.name, system: "Microsoft 365", login: e.email!, access: dep === "MGT" ? "Global admin" : "User", mfa: true, closed: exited ? { status: "DISABLED", note: "Mailbox converted to shared; Priya has access" } : undefined });
    accountSeeds.push({ who: e.name, system: "Slack", login: e.email!, mfa: dep === "ENG", closed: exited ? { status: "DELETED" } : undefined });
    if (dep === "ENG" || e.locationId === remote.id) accountSeeds.push({ who: e.name, system: "FortiClient", login: handle(e), mfa: true });
    if (dep === "ENG" && e.name !== "Meera Nair") {
      accountSeeds.push({ who: e.name, system: "GitHub", login: `${handle(e).replace(".", "-")}-nw`, access: e.name === "Priya Deshmukh" ? "Owner" : "Member", mfa: true });
      accountSeeds.push({ who: e.name, system: "Jira", login: e.email!, closed: exited ? { status: "DISABLED" } : undefined });
    }
    if (["Vikram Singh", "Aarav Sharma", "Harsh Vardhan"].includes(e.name)) {
      accountSeeds.push({ who: e.name, system: "AWS", login: handle(e), access: e.name === "Vikram Singh" ? "AdministratorAccess" : "Developer", mfa: true, closed: exited ? { status: "DELETED", note: "IAM user and access keys deleted" } : undefined });
    }
    if (dep === "SAL") accountSeeds.push({ who: e.name, system: "Zoho", login: e.email!, access: e.name === "Amit Patil" ? "Manager" : "Sales rep" });
  }
  accountSeeds.push(
    { who: "Kavya Menon", system: "Tally", login: "kavya", access: "Owner", password: "Tally@Nw2026", notes: "Also knows the company data password" },
    { who: "Suresh Pillai", system: "Tally", login: "suresh", access: "Data entry", password: "Suresh#4410" },
    { who: "Siddharth Kulkarni", system: "Tally", login: "siddharth", access: "Read-only" },
    { who: "Kavya Menon", system: "HDFC", login: "NWFIN01", access: "Approver", mfa: true, notes: "Password kept in the finance safe — not stored here" },
    { who: "Suresh Pillai", system: "HDFC", login: "NWFIN02", access: "Maker", mfa: true },
    { who: "Meera Nair", system: "Figma", login: "meera.nair@northwind.in", access: "Admin", mfa: true },
    { who: "Sneha Joshi", system: "Figma", login: "sneha.joshi@northwind.in", access: "Editor" },
    { who: "Pooja Mehta", system: "Google Ads", login: "pooja.mehta@northwind.in", access: "Admin", mfa: true },
    { who: "Arjun Rao", system: "Google Ads", login: "arjunrao.content@gmail.com", access: "Standard", personal: true, notes: "Personal Gmail — remove from Ads and Analytics on exit" },
    { who: "Rahul Verma", system: "Zoho", login: "rahulverma.biz@gmail.com", access: "Sales rep", personal: true, notes: "Uses personal Gmail for lead forms" },
    { who: "Pooja Mehta", system: "LinkedIn", login: "Pooja Mehta (personal profile)", access: "Super admin", personal: true },
    { who: "Siddharth Kulkarni", system: "Google Ads", login: "sid.kulkarni91@gmail.com", access: "Read-only", personal: true },
    { who: "Siddharth Kulkarni", system: "FortiClient", login: "siddharth.kulkarni", password: "Vpn!Sid2026" },
  );
  for (const a of accountSeeds) {
    const e = emp(a.who);
    const granted = e.joiningDate ? new Date(e.joiningDate.getTime() + (1 + Math.floor(rand() * 20)) * DAY) : null;
    await db.employeeAccount.create({
      data: {
        employeeId: e.id, systemId: sys(a.system), username: a.login ?? e.email!, accessLevel: a.access ?? null, mfaEnabled: !!a.mfa, personal: !!a.personal,
        grantedAt: granted, passwordEnc: a.password ? encrypt(a.password) : null, notes: a.notes ?? null,
        ...(a.closed ? { status: a.closed.status, closedAt: new Date(daysFromToday(-39).getTime() + 6 * 3_600_000), closedById: admin.id, closeNote: a.closed.note ?? null } : {}),
      },
    });
  }

  console.log(`Seeded: ${employees.length} employees (${activeEmployees.length} active), ${assets.length} assets, ${createdSubs.length} subscriptions, ${ticketSeeds.length} tickets, ${accountSeeds.length} logins.`);
  console.log(`Login: admin@company.com / ${password === "Admin@123" ? "Admin@123" : "(SEED_ADMIN_PASSWORD)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
