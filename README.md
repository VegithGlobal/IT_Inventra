# IT Ops Hub

One place for a company's IT: hardware assets and who has them, subscriptions and renewals, expenses and invoices, tickets, repairs, consumable stock, software licenses and every login each employee has — with reminders so nothing lapses.

Built for a single IT admin (plus optional IT staff and read-only viewers). Indian defaults: ₹ with Indian grouping (₹1,23,456.00), IST, GST on expenses, financial year April–March.

## What's in it

| Area | Highlights |
|---|---|
| **Dashboard** | Live stats with trends, renewals due, your open tickets, 12-month spend by category, assets by status/type, warranty & low-stock watchlists, recent activity |
| **Assets** | Auto tags (`LAP-0001`), specs, warranty, straight-line depreciation and book value, CSV import, bulk status, QR labels, table/grid views |
| **Assignments** | Check-out / check-in / transfer with full history, accessories, condition, printable handover & return forms, offboarding helper |
| **Employees · Vendors** | Directory with assets, licenses, stock and tickets per person; vendor spend and documents |
| **Subscriptions** | Billing cycles, "Mark as paid" (creates the expense, moves the due date), void, calendar, encrypted credentials |
| **Expenses** | Every IT spend with GST split, links to assets/subscriptions/tickets/stock, charts, FY comparison, monthly summary |
| **Invoices & documents** | Upload PDFs/images, inline preview, search by invoice #, vendor, amount, date |
| **Tickets** | Quick add (press **N**), Kanban, table, My Today, timeline, time tracking, parts used, insights, recurring tasks |
| **Maintenance** | Repairs (asset → Under repair → back), costs as expenses, preventive schedules |
| **Inventory** | Stock in / issue / adjust with full movement log and low-stock alerts |
| **Licenses** | Per-user / per-device / site, seat assignment, encrypted keys, expiry |
| **Accounts & logins** | Every login per employee (company email, Google/Gmail, Microsoft 365, software, cloud, VPN, banking…) with access level, 2FA and optional AES-256 encrypted password (every reveal is audited). When someone leaves: a block-list on their profile, one-click "Mark disabled" / close-all, a printable offboarding checklist with "how to block" steps per system, dashboard and notification alerts for leavers with open logins. CSV import |
| **Reminders & notifications** | Renewals, overdue payments, warranty & license expiry, low stock, ticket due, asset returns, leavers with active logins, custom reminders; bell + email digest |
| **Reports** | 12 reports (incl. access review and leavers' access) with filters and CSV / Excel / PDF export |
| **Audit log** | Every change: who, what, before/after |
| **Search** | Ctrl/⌘ K across assets, people, tickets, subscriptions, documents, vendors, licenses, logins, systems, stock |
| **Settings** | Company profile & logo, users & roles, categories, departments, locations, asset types, notifications, backup export |

**Roles:** Admin (everything) · IT staff (day-to-day work, no settings) · Viewer (read-only).

## Tech

Next.js 16 (App Router, Cache Components) · TypeScript (strict) · PostgreSQL + Prisma 7 · NextAuth (email + password) · Tailwind CSS 4 + Radix UI · TanStack Table · React Hook Form + Zod · Recharts · Nodemailer.

## Requirements

- Node.js 20.19+ (developed on Node 24)
- PostgreSQL 14+ (developed on 16)

## Quick start (local, with demo data)

```bash
git clone https://github.com/VegithGlobal/IT_Inventra.git
cd IT_Inventra
npm install                      # also generates the Prisma client
cp .env.example .env             # then fill it in — see below
createdb it_ops_hub              # or create it in pgAdmin
npm run db:migrate               # creates the tables
npm run db:seed                  # ⚠ wipes the database and loads sample data
npm run dev                      # http://localhost:3000
```

Demo logins (password `Admin@123`, or `SEED_ADMIN_PASSWORD`): `admin@company.com`, `staff@company.com`, `viewer@company.com`.

## Real install (no demo data)

```bash
npm install
cp .env.example .env             # production values — see below
npm run db:migrate
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-long-password-123' ADMIN_NAME='Your Name' \
COMPANY_NAME='Your Company Pvt Ltd' npm run db:init
npm run build
npm run start                    # port 3000; put Nginx/Caddy in front for HTTPS
```

`db:init` creates the default settings, asset types (tag prefixes), built-in expense categories, ticket categories and your first admin. It's safe to re-run. On Windows PowerShell set the variables first, e.g. `$env:ADMIN_EMAIL="you@company.com"`.

Then sign in and work through **Settings**: company profile and logo, departments, locations, more logins under Users & roles, and notification email. Import existing data with **Assets → Import CSV** and **Employees → Import CSV** (each has a template download). If your current list is in Excel (like `legacy/All_Assets_List.xlsx`), save it as CSV with the template's columns.

> `npm run db:seed` refuses to run when `NODE_ENV=production` (it would wipe everything). Set `ALLOW_DEMO_SEED=1` only if you really mean it.

## Configuration (.env)

Every variable is explained in [`.env.example`](.env.example). The essentials:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | The app's public URL (also used in QR labels and email links) |
| `NEXTAUTH_SECRET` | Random secret for sessions — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ENCRYPTION_KEY` | 64 hex chars for encrypting credentials and license keys — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Back it up; changing it makes stored secrets unreadable.** |
| `CRON_SECRET` | Protects the reminders endpoint |
| `SMTP_*` | Outgoing email for reminders (optional; leave `SMTP_HOST` empty to disable) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Where uploaded files go (default `./uploads`) and the size limit (10 MB) |

## Reminders (scheduled job)

Reminders are created by one endpoint. Running it more than once is harmless — nothing is sent twice.

```
POST /api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

Pick one way to run it:

- **Vercel** — `vercel.json` already schedules it daily at 08:00 IST.
- **Your own server, built in** — set `CRON_MODE="internal"`; the app calls it every hour.
- **System cron** — e.g. hourly:
  `0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://it.example.com/api/cron/reminders`
- **Manually** — Reminders → **Run now**.

Hourly is best if you rely on ticket-due reminders; daily is enough for renewals and expiries. Timing and which types are emailed are under **Settings → Notifications**, which also has a **Send test email** button.

## Backups

- **Settings → Backup & export** downloads a zip with `data.json` (every table) and one CSV per table, optionally with uploaded files. Password hashes are never exported; encrypted fields stay encrypted.
- For disaster recovery also back up PostgreSQL itself, e.g. nightly: `pg_dump -Fc it_ops_hub > it_ops_hub-$(date +%F).dump`, plus the `uploads/` folder and your `.env` (especially `ENCRYPTION_KEY`).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / server |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:init` | First-run setup without demo data |
| `npm run db:seed` | ⚠ Wipe and load demo data |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Viewing the database

pgAdmin or any SQL client works. Table and column names are CamelCase, so quote them: `SELECT "assetTag", name, status FROM "Asset";`. Prefer making changes in the app — direct edits skip the audit log and business rules.

## Project layout

```
prisma/              schema, migrations, seed.ts (demo), init.ts (first run)
src/app/(app)/       pages inside the app shell
src/app/(print)/     printable forms, labels and reports
src/app/api/         auth, files, search, backup, cron, logo
src/features/<area>/ schema.ts (zod, shared client/server) · actions.ts (server actions) · queries.ts · UI
src/components/      UI kit (ui/), data table, shell, shared pieces
src/lib/             db, auth, createAction (role check + validation + audit), dates, money, storage, email, crypto
docs/SPEC.md         the product spec
```

Every change goes through `createAction` (`src/lib/action.ts`): sign-in check → role check (viewers are read-only) → Zod validation → one database transaction → audit log entry.

## Notes

- Uploaded files are stored on disk under `UPLOAD_DIR` and only served to signed-in users. The storage layer (`src/lib/storage`) is where an S3 / Cloudflare R2 driver would plug in.
- If a page breaks with "… is not a function" or an `undefined` export right after editing code during `npm run dev`, restart the dev server (`Ctrl+C`, then `npm run dev`) — the dev bundler occasionally keeps a stale copy of a changed file.
