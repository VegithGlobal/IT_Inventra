import { strToU8, zipSync, type Zippable } from "fflate";
import { writeAudit } from "@/lib/audit";
import { toCsv, type CsvValue } from "@/lib/csv";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";
import { storage } from "@/lib/storage";

/**
 * Full data export (ADMIN only): data.json with every table, one CSV per table, and optionally
 * the uploaded files. Password hashes are never exported; encrypted fields stay encrypted.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Only admins can export backups.", { status: 403 });
  const withFiles = new URL(request.url).searchParams.get("files") === "1";

  const tables = {
    users: (await db.user.findMany({ orderBy: { createdAt: "asc" } })).map((u) => ({ ...u, passwordHash: undefined })), // undefined is dropped by JSON.stringify
    settings: await db.setting.findMany(),
    departments: await db.department.findMany(),
    locations: await db.location.findMany(),
    vendors: await db.vendor.findMany(),
    employees: await db.employee.findMany(),
    assetTypes: await db.assetType.findMany(),
    assets: await db.asset.findMany(),
    assetAssignments: await db.assetAssignment.findMany(),
    maintenanceRecords: await db.maintenanceRecord.findMany(),
    inventoryItems: await db.inventoryItem.findMany(),
    stockMovements: await db.stockMovement.findMany(),
    subscriptions: await db.subscription.findMany(),
    subscriptionPayments: await db.subscriptionPayment.findMany(),
    licenses: await db.license.findMany(),
    licenseSeats: await db.licenseSeat.findMany(),
    expenseCategories: await db.expenseCategory.findMany(),
    expenses: await db.expense.findMany(),
    documents: await db.document.findMany(),
    ticketCategories: await db.ticketCategory.findMany(),
    tickets: await db.ticket.findMany(),
    ticketComments: await db.ticketComment.findMany(),
    reminders: await db.reminder.findMany(),
    notifications: await db.notification.findMany(),
    auditLog: await db.auditLog.findMany(),
  };

  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const company = await getCompany();
  // JSON.stringify turns Decimal into strings and Date into ISO strings.
  const json = JSON.stringify({ exportedAt: now.toISOString(), exportedBy: user.email, company: company.name, app: "IT Ops Hub", tables }, null, 2);

  const files: Zippable = {
    "data.json": strToU8(json),
    "README.txt": strToU8(
      [
        `IT Ops Hub backup — ${company.name}`,
        `Exported ${now.toISOString()} by ${user.email}`,
        "",
        "data.json  — every table (Decimal values as strings, dates as ISO-8601 UTC).",
        "csv/       — one spreadsheet per table.",
        withFiles ? "files/     — uploaded documents, by storage key." : "Uploaded files are not included (export again with files to add them).",
        "",
        "Not included: login password hashes. Encrypted fields (credentials, license keys) stay",
        "encrypted and need the same ENCRYPTION_KEY to read.",
      ].join("\n"),
    ),
  };
  const plain = JSON.parse(json).tables as Record<string, Record<string, unknown>[]>;
  for (const [name, rows] of Object.entries(plain)) {
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const data = rows.map((r) => headers.map((h): CsvValue => {
      const v = r[h];
      return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : (v as CsvValue);
    }));
    files[`csv/${name}.csv`] = strToU8("﻿" + toCsv(headers, data));
  }

  if (withFiles) {
    const keys = [...tables.documents.map((d) => d.fileKey), ...(company.logoKey ? [company.logoKey] : [])];
    for (const key of keys) {
      const data = await storage.get(key);
      if (data) files[`files/${key}`] = new Uint8Array(data);
    }
  }

  const zip = zipSync(files, { level: 6 });
  await writeAudit(db, user.id, {
    action: "CREATE",
    entityType: "Backup",
    entityId: stamp,
    entityLabel: `Data export${withFiles ? " with files" : ""} (${(zip.length / 1024 / 1024).toFixed(1)} MB)`,
  });

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="it-ops-hub-backup-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
