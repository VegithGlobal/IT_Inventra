// One-off import of the old "All Assets List.xlsx" sheet (exported to legacy/all-assets-list.json).
// Adds assets, creates an Employee for every current user (placeholder ID "TMP-xxxx", fill details later),
// checks the asset out to them, and keeps the last three past users on Asset.previousUsers.
// Safe to re-run: rows already imported (matched by the note marker) are skipped.
// Run: npx tsx prisma/import-legacy-assets.ts [path/to/all-assets-list.json] [--dry-run]

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import type { AssetCondition, AssetStatus } from "../src/generated/prisma/enums";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const SOURCE = "All Assets List.xlsx";

type Raw = { row: number; cells: string[] };

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().replace(/^[,\s]+|[,\s]+$/g, "");

const istToday = (() => {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
})();

// ─── names ──────────────────────────────────────────────────────────────────

const KEEP_UPPER = new Set(["MLPL", "CFO", "JSW", "CSS", "COSMOS", "HO"]);

/** "RINA SETH" → "Rina Seth", "shravan panchal" → "Shravan Panchal"; mixed case and (…) kept as typed. */
function personName(s: string) {
  let depth = 0;
  return clean(s)
    .split(" ")
    .map((w) => {
      const inParens = depth > 0 || w.startsWith("(");
      depth += (w.match(/\(/g)?.length ?? 0) - (w.match(/\)/g)?.length ?? 0);
      if (inParens || w.includes("(")) return w;
      const letters = w.replace(/[^a-z]/gi, "");
      if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase();
      if (w === w.toUpperCase() && letters.length <= 2) return w;
      if (w === w.toUpperCase() || w === w.toLowerCase()) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w;
    })
    .join(" ");
}
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9()]/g, "");

/** Values in the "user" columns that are places, stock or outcomes rather than people. */
const NOT_A_PERSON =
  /^(sold\b.*|lost|stock\b.*|srock\b.*|spare( laptop| desktop)?|server|.*\bserver|reception|boardroom|vasai factory|andheri|bhiwandi|banglore|gurugram|in use|in stock)$/i;
const isPerson = (s: string) => s !== "" && !NOT_A_PERSON.test(s);

/** "A / B\ C/Not Return(Rakesh)/Lost by D" → most recent first: ["D", "Rakesh (not returned)", "C", "B", "A"]. */
function parsePastUsers(s: string) {
  return clean(s)
    .split(/[/\\]/)
    .map((p) =>
      clean(p)
        .replace(/^lost by\s+/i, "")
        .replace(/^not return\s*\((.+)\)$/i, "$1 (not returned)")
        .replace(/'s desktop$/i, "")
        .replace(/\s*\(pass-[^)]*\)/i, ""),
    )
    .filter(isPerson)
    .map(personName)
    .reverse();
}

/** "ravi - 9800000000" → { name: "Ravi", phone: "9800000000" }; "Ravi / Amit" → first + shared. */
function parseCurrent(s: string) {
  const [first, ...others] = clean(s).split(/\s*\/\s*/);
  const phone = first.match(/[-–]\s*(\d{10})\s*$/)?.[1] ?? null;
  const name = personName(first.replace(/\s*[-–]\s*\d{10}\s*$/, "").replace(/\s*\(stolen\)\s*$/i, ""));
  return { name, phone, stolen: /\(stolen\)/i.test(first), shared: others.map(personName).filter(Boolean) };
}

// ─── lookups ────────────────────────────────────────────────────────────────

const LOCATION_ALIASES: Record<string, string> = { banglore: "Bangalore", gurgoan: "Gurugram", gurugram: "Gurugram" };

type TypeSpec = { name: string; prefix?: string; label: string; computer?: boolean };
function typeOf(raw: string, model: string): TypeSpec {
  const t = clean(raw).toLowerCase();
  if (t === "laptop" || (!t && /latitude|elitebook|thinkpad/i.test(model))) return { name: "Laptop", label: "Laptop", computer: true };
  if (t === "desktop") return { name: "Desktop", label: "Desktop", computer: true };
  if (t === "telephone") return { name: "Phone", label: "Telephone" };
  if (t === "moniter" || t === "monitor") return { name: "Monitor", label: "Monitor" };
  if (t === "kerboard" || t === "keyboard") return { name: "Keyboard/Mouse", label: "Keyboard" };
  if (t === "mouse") return { name: "Keyboard/Mouse", label: "Mouse" };
  if (t === "printer") return { name: "Printer", label: "Printer" };
  if (t.startsWith("xp")) return { name: "Tablet", label: "Pen tablet" };
  if (t === "firewall") return { name: "Firewall", prefix: "FWL", label: "Firewall" };
  if (t === "hdd" || t === "ssd") return { name: "Storage Drive", prefix: "DRV", label: t.toUpperCase() };
  if (t === "led tv") return { name: "Other", label: "LED TV" };
  return { name: "Other", label: clean(raw) || "Asset" };
}

function statusOf(raw: string): "IN_USE" | "IN_STOCK" | "SOLD" | "LOST" | "" {
  const s = clean(raw).toLowerCase();
  if (s === "in use") return "IN_USE";
  if (s === "in stock") return "IN_STOCK";
  if (s === "sold") return "SOLD";
  if (s === "lost") return "LOST";
  return "";
}

// ─── row normalisation ──────────────────────────────────────────────────────

type Row = {
  sheet: string;
  row: number;
  tag: string;
  type: TypeSpec;
  brand: string;
  model: string;
  serial: string;
  cpu: string;
  ram: string;
  storage: string;
  past: string;
  status: string;
  current: string;
  location: string;
  company: string;
  remarks: string[];
};

function fromMain({ row, cells: c }: Raw): Row {
  return {
    sheet: "ALl Asset List", row, tag: clean(c[0]), type: typeOf(c[1], c[3]), brand: clean(c[2]), model: clean(c[3]), serial: clean(c[4]),
    cpu: clean(c[5]), ram: clean(c[6]), storage: clean(c[7]), past: clean(c[8]), status: clean(c[9]), current: clean(c[10]), location: clean(c[11]),
    company: "", remarks: [],
  };
}

function fromPeripheral({ row, cells: c }: Raw): Row {
  const location = clean(c[13]);
  // Column J ("Past User Names") mostly holds a status or the location here; only a name counts as a past user.
  const j = clean(c[9]);
  const jIsUser = isPerson(j) && j.toLowerCase() !== location.toLowerCase();
  const remarks = [clean(c[14]), clean(c[15])].filter((r) => r && r.toLowerCase() !== location.toLowerCase());
  return {
    sheet: "peripheral devices", row, tag: clean(c[0]), type: typeOf(c[1], c[4]), brand: clean(c[3]), model: clean(c[4]), serial: clean(c[5]),
    cpu: "", ram: "", storage: clean(c[8]), past: jIsUser ? j : "", status: clean(c[10]) || (jIsUser ? "" : j), current: clean(c[11]), location,
    company: clean(c[2]), remarks,
  };
}

const JUNK_SERIAL = /^(no[- ]?sn|foxin|o\.e\.m faild)$/i;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--")) ?? "legacy/all-assets-list.json";
  const data = JSON.parse(await readFile(file, "utf8")) as { main: Raw[]; peripheral: Raw[] };
  const rows = [...data.main.map(fromMain), ...data.peripheral.map(fromPeripheral)];

  const [existingAssets, employees, locations] = await Promise.all([
    db.asset.findMany({ select: { assetTag: true, serialNumber: true, notes: true } }),
    db.employee.findMany({ where: { deletedAt: null }, select: { id: true, name: true, employeeCode: true } }),
    db.location.findMany({ where: { deletedAt: null } }),
  ]);
  const usedTags = new Set(existingAssets.map((a) => a.assetTag.toLowerCase()));
  const usedSerials = new Set(existingAssets.flatMap((a) => (a.serialNumber ? [a.serialNumber.toLowerCase()] : [])));
  const done = new Set(existingAssets.flatMap((a) => a.notes?.match(/\[sheet-import:[^\]]+\]/g) ?? []));
  const people = new Map(employees.map((e) => [nameKey(e.name), e.id]));
  let tmpSeq = Math.max(0, ...employees.map((e) => Number(e.employeeCode.match(/^TMP-(\d+)$/)?.[1] ?? 0))) + 1;

  const typeCache = new Map<string, string>();
  async function typeId(t: TypeSpec) {
    if (typeCache.has(t.name)) return typeCache.get(t.name)!;
    let type = await db.assetType.findUnique({ where: { name: t.name } });
    if (!type) {
      const sortOrder = ((await db.assetType.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;
      type = await db.assetType.create({ data: { name: t.name, prefix: t.prefix ?? t.name.slice(0, 3).toUpperCase(), sortOrder } });
      console.log(`+ asset type ${t.name}`);
    }
    typeCache.set(t.name, type.id);
    return type.id;
  }

  async function locationId(raw: string) {
    if (!raw) return null;
    const name = LOCATION_ALIASES[raw.toLowerCase()] ?? raw;
    let loc = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!loc) {
      loc = await db.location.create({ data: { name } });
      locations.push(loc);
      console.log(`+ location ${name}`);
    }
    return loc.id;
  }

  const stats = { assets: 0, assigned: 0, employees: 0, skipped: 0, retagged: [] as string[] };

  for (const r of rows) {
    const marker = `[sheet-import:${r.sheet}#${r.row}]`;
    if (done.has(marker)) {
      stats.skipped++;
      continue;
    }
    const notes: string[] = [];

    // Brand / model / name
    const brandValid = r.brand && !r.brand.includes("/") && r.brand.toLowerCase() !== r.type.label.toLowerCase() && r.brand.toLowerCase() !== "laptop";
    const brand = brandValid ? r.brand : /^[a-z]+\b/i.test(r.model) && r.model.toLowerCase() !== r.type.label.toLowerCase() ? r.model.split(" ")[0] : "";
    const brandNice = brand && brand === brand.toLowerCase() ? brand.charAt(0).toUpperCase() + brand.slice(1) : brand;
    const modelIsFiller = !r.model || [brand.toLowerCase(), r.type.label.toLowerCase()].includes(r.model.toLowerCase());
    const model = modelIsFiller ? "" : r.model;
    const name = model
      ? brand && !model.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brandNice} ${model}`
        : model
      : [brandNice, r.type.label, !r.type.computer && r.storage].filter(Boolean).join(" ");

    // Tag: keep the sheet's asset no. unless it's missing or already taken.
    const tId = await typeId(r.type);
    let tag = /^asset_\d+$/i.test(r.tag) && !usedTags.has(r.tag.toLowerCase()) ? r.tag : "";

    // Serial
    let serial = JUNK_SERIAL.test(r.serial) ? "" : r.serial.replace(/\s*\/\s*/g, " / ");
    if (serial && usedSerials.has(serial.toLowerCase())) {
      notes.push(`Serial ${serial} is already on another asset.`);
      serial = "";
    }

    // Status + people
    const st = statusOf(r.status);
    const current = r.current && isPerson(r.current) ? parseCurrent(r.current) : null;
    let previous = parsePastUsers(r.past);
    let status: AssetStatus = "IN_STOCK";
    let holder: { name: string; phone: string | null } | null = null;
    if (st === "SOLD") status = "DISPOSED";
    else if (st === "LOST" || current?.stolen) status = "LOST_STOLEN";
    if ((st === "IN_USE" || st === "") && current) {
      status = "ASSIGNED";
      holder = current;
      if (current.shared.length) notes.push(`Shared with: ${current.shared.join(", ")}.`);
    } else if (current) {
      // Not in use any more (lost / sold / in stock): the named person was its last user.
      previous = [current.name, ...previous];
      if (current.stolen) notes.push(`Stolen while with ${current.name}.`);
    }
    if (r.current && !isPerson(r.current) && !/^(sold|lost)$/i.test(r.current)) notes.push(st === "IN_USE" ? `In use at: ${r.current}.` : `Sheet status: ${r.current}.`);
    const seen = new Set(holder ? [nameKey(holder.name)] : []);
    previous = previous.filter((p) => !seen.has(nameKey(p)) && (seen.add(nameKey(p)), true)).slice(0, 3);

    // Specs / condition / notes
    const specs = r.type.computer
      ? Object.fromEntries(Object.entries({ cpu: r.cpu, ram: r.ram === r.cpu ? "" : r.ram, storage: r.storage }).filter(([, v]) => v))
      : r.storage
        ? { storage: r.storage }
        : {};
    const remarkText = r.remarks.join(" · ");
    const condition: AssetCondition = /not working|dead/i.test(remarkText) ? "POOR" : "GOOD";
    for (const rem of r.remarks) if (!/^good condition$/i.test(rem)) notes.push(rem);
    if (r.company) notes.push(`Company: ${r.company}.`);
    if (r.tag && !tag) notes.push(`Sheet asset no. ${r.tag} was used twice; given a new tag.`);
    notes.push(`Imported from ${SOURCE}, sheet "${r.sheet}" row ${r.row}. ${marker}`);

    if (dryRun) {
      console.log([r.tag || "(new tag)", r.type.name, name, serial, status, holder ? `${holder.name}${holder.phone ? ` ${holder.phone}` : ""}` : "", previous.join(", "), r.location, notes.slice(0, -1).join(" ")].join(" | "));
      if (tag) usedTags.add(tag.toLowerCase());
      if (serial) usedSerials.add(serial.toLowerCase());
      continue;
    }

    await db.$transaction(async (tx) => {
      if (!tag) {
        const type = await tx.assetType.update({ where: { id: tId }, data: { nextSequence: { increment: 1 } } });
        tag = `${type.prefix}-${String(type.nextSequence - 1).padStart(4, "0")}`;
        stats.retagged.push(`${r.tag || "(blank)"} → ${tag}`);
      }
      const locId = await locationId(r.location);

      let holderId: string | null = null;
      if (holder) {
        holderId = people.get(nameKey(holder.name)) ?? null;
        if (!holderId) {
          const emp = await tx.employee.create({
            data: {
              employeeCode: `TMP-${String(tmpSeq++).padStart(4, "0")}`,
              name: holder.name,
              phone: holder.phone,
              locationId: locId,
              notes: `Created from ${SOURCE}. Replace the TMP employee ID and add details.`,
            },
          });
          holderId = emp.id;
          people.set(nameKey(holder.name), emp.id);
          stats.employees++;
        }
      }

      const asset = await tx.asset.create({
        data: {
          assetTag: tag,
          name,
          typeId: tId,
          brand: brandNice || null,
          model: model || null,
          serialNumber: serial || null,
          specs: Object.keys(specs).length ? (specs as Prisma.InputJsonObject) : undefined,
          locationId: locId,
          condition,
          status,
          currentHolderId: holderId,
          previousUsers: previous,
          notes: notes.join("\n"),
        },
      });
      if (holderId) {
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            employeeId: holderId,
            issuedAt: istToday,
            conditionAtIssue: condition,
            issueNotes: `Recorded from ${SOURCE}; the real issue date isn't known.`,
          },
        });
        stats.assigned++;
      }
      await tx.auditLog.create({
        data: { action: "CREATE", entityType: "Asset", entityId: asset.id, entityLabel: `${asset.assetTag} · ${asset.name} (sheet import)`, after: JSON.parse(JSON.stringify(asset)) },
      });
    });

    usedTags.add(tag.toLowerCase());
    if (serial) usedSerials.add(serial.toLowerCase());
    stats.assets++;
  }

  console.log(`\nAssets imported: ${stats.assets} (${stats.assigned} assigned) · employees created: ${stats.employees} · already imported: ${stats.skipped}`);
  if (stats.retagged.length) console.log(`New tags for duplicate/blank asset numbers:\n  ${stats.retagged.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
