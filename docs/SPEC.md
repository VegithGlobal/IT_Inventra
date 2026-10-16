# PROJECT: IT Operations Hub — build spec

> Source of truth for the rebuild. The original "premium dark + neon lime" design section was
> **replaced** by the light theme in the "UI / DESIGN SYSTEM" section below. There is no dark theme.

A complete IT Asset & Operations Management web app for a single IT admin managing the company's IT.
It follows standard ITAM/ITSM practices (Snipe-IT, Freshservice, ManageEngine) but stays simple, fast, and beautiful.

## Step 0 — Clean start (done)
1. Backup commit `325b24a` ("backup before rebuild") on `main`; work happens on branch `rebuild-it-hub`.
2. Old app code removed; `.env` kept as `.env.old` for reference.
3. Fresh project scaffolded with the stack below.

## Tech stack
- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui (restyled to the theme) + lucide-react icons
- PostgreSQL + Prisma ORM (SQLite for local dev if Postgres isn't set up; switchable via .env)
- Auth: NextAuth (Auth.js) with email+password (bcrypt). Roles: ADMIN, IT_STAFF, VIEWER
- Forms: react-hook-form + zod (shared schemas for client and server)
- Tables: TanStack Table (sorting, filtering, pagination, column visibility, CSV export)
- Charts: Recharts · Dates: date-fns
- File uploads: local `/uploads` in dev, behind an abstraction so S3 / Cloudflare R2 can be swapped in
- Background jobs/reminders: cron route `/api/cron/reminders` (Vercel Cron or node-cron)
- Email: Nodemailer (SMTP from .env)
- Animations: framer-motion
- Server Actions for mutations, zod validation on every action

## Modules

### 1. Dashboard (home)
- Stats: Total Assets, Assigned, In Stock, Under Repair, Open Tickets, This Month's IT Spend, Upcoming Renewals (next 30 days)
- "Upcoming Payments & Renewals" (WiFi, cloud servers, licenses, domains). Due within 7 days → highlighted; overdue → red status
- "My Open Tickets" (priority dot, status pill, age)
- Expense chart: monthly spend, last 12 months, stacked by category
- Assets by status (donut), assets by type (bar)
- Warranty expiring soon list
- Recent activity feed (from the audit log)
- Quick actions: + Asset, + Ticket, + Expense, Assign Asset, Upload Invoice

### 2. Asset Management (hardware)
- Asset types (configurable): Laptop, Desktop, Monitor, Printer, Router/Switch, Access Point, Phone, Tablet, Keyboard/Mouse, UPS, Server, Other
- Fields: auto Asset Tag (LAP-0001, prefix per type), name, type, brand, model, serial number (unique), specs (CPU/RAM/storage as JSON or custom fields), purchase date, purchase cost, vendor, invoice link, warranty start/end, location, department, condition (New/Good/Fair/Poor), status, notes, photos
- Statuses: In Stock, Assigned, Under Repair, In Transit, Lost/Stolen, Retired, Disposed
- List view (table) + grid view (cards), advanced filters, search by tag/serial/user, CSV bulk import (with template download), bulk status change, QR code per asset (printable label with tag + QR linking to the asset page)
- Detail page tabs: Overview | Assignment History | Maintenance | Tickets | Documents | Activity Log
- Depreciation: straight-line, configurable useful life per type; show current book value

### 3. Assignment / Check-out & Check-in
- Assign to an employee: date issued, expected return (optional), condition at issue, accessories (charger, bag, mouse), notes, optional signed handover form upload
- Check-in: return date, condition at return, damage notes; new status In Stock or Under Repair
- Transfer between employees (logged as check-in + check-out)
- Full history: every assignment is permanent. Asset shows every holder with dates and duration; employee shows current and past assets
- Printable PDF "Asset Handover Form" and "Asset Return Form"
- Offboarding helper: employee marked as leaving → list assets still held with one-click returns

### 4. Employees (directory)
- Staff who RECEIVE assets; they do NOT log in
- Fields: employee ID, name, email, phone, department, designation, location, joining date, exit date, status (Active/Exited), photo
- Profile: current assets, asset history, related tickets, total value of assets held
- CSV import

### 5. Inventory / Stock (consumables & accessories)
- Quantity-tracked items: mice, keyboards, cables, toner, RAM sticks, adapters, chargers
- Fields: name, category, SKU, quantity on hand, minimum stock level, unit cost, location, vendor
- Movements: Stock In (purchase, invoice link), Stock Out (to employee or ticket), Adjustment. All logged
- Low stock alert when quantity ≤ minimum (dashboard + notification)

### 6. Subscriptions & Recurring Services
- WiFi/ISP, cloud servers (AWS, Azure, DigitalOcean, Hostinger…), domains, SSL, software subscriptions (M365, Google Workspace, antivirus), AMC contracts, phone/SIM plans
- Fields: service name, category, provider/vendor, account/customer ID, plan details, amount, currency (default INR), billing cycle (Monthly, Quarterly, Half-yearly, Yearly, Custom days), start date, next due date (auto-calculated), auto-renew, payment method, linked location/department, login URL, notes, status (Active/Paused/Cancelled)
- "Mark as Paid": records payment (date, amount, mode, transaction ref, invoice upload), auto-creates an Expense, advances next due date by one cycle
- Payment history per subscription
- Calendar view of upcoming due dates
- Never store passwords in plain text: reference note only, or AES-256 with a key from .env

### 7. Reminders & Notifications
- Automatic: subscription due (default 7, 3, 1 days before + due day), overdue payments, warranty expiry (30 days), license expiry, low stock, ticket due dates, asset expected-return dates
- Custom manual reminders (title, date, repeat rule, notes)
- In-app bell with unread count, notification center, mark-as-read
- Email via SMTP (toggle per reminder type in Settings)
- `/api/cron/reminders` protected by CRON_SECRET, daily, idempotent

### 8. Expenses
- Categories: hardware, subscription payments, repairs, consumables, services, misc
- Fields: date, category, description, amount, tax/GST, total, vendor, payment mode (UPI, Card, Bank Transfer, Cash, Cheque), transaction ref, linked entity (asset / subscription / ticket / stock item — polymorphic), invoice attachment, paid-by, notes
- Auto-created from: subscription "Mark as Paid", asset purchases, stock-in, maintenance costs
- Views: table with filters (date range, category, vendor), monthly summary, category breakdown chart, year-over-year comparison
- Export CSV/Excel

### 9. Invoices & Documents
- Vault for PDFs/images (invoices, receipts, warranty cards, quotations, handover forms, contracts)
- Metadata: document type, invoice number, invoice date, vendor, amount, linked entity (asset/subscription/expense/ticket)
- Inline preview (PDF + images), download
- Search by invoice number, vendor, amount, date
- Max 10MB; pdf, jpg, png, webp

### 10. Tickets / Helpdesk (self-logged)
- Quick-add modal, keyboard shortcut "N", only title + requester required
- Fields: TKT-0001, title, description, requester (employee), category (Hardware, Software, Network/WiFi, Email, Printer, Access/Account, Server/Cloud, Other), priority (Low/Medium/High/Critical), status (Open, In Progress, Waiting on User, Waiting on Vendor, Resolved, Closed), linked asset, due date, resolution notes, time spent (minutes), source (Walk-in, Phone, WhatsApp, Email, Self-identified)
- Timeline: comments, status changes, attachments
- Views: Kanban (drag), table, "My Today"
- Metrics: per month, avg resolution time, top categories, top requesters, most problematic assets
- Recurring tasks auto-create tickets on a schedule

### 11. Maintenance & Repairs
- Fields: issue, date sent, vendor/service center, cost, expected return, actual return, outcome, under warranty
- Open maintenance → asset "Under Repair"; closing returns the previous status
- Cost auto-creates an Expense
- Preventive maintenance schedules generate reminders

### 12. Software Licenses
- Name, vendor, key (encrypted), type (Per-user, Per-device, Site), total seats, seats used, purchase date, expiry, cost, linked subscription
- Assign seats to employees or assets; available seats; expiry reminders

### 13. Vendors
- Name, contact person, phone, email, address, GSTIN, category (ISP, Hardware, Cloud, Service Center, Software), website, notes
- Vendor page: assets bought, subscriptions, expenses, total spend, documents

### 14. Locations & Departments — master data used everywhere

### 15. Reports
- Asset register (with value); by employee / department / location; assignment history; depreciation; expenses (category/vendor/month, custom range); upcoming renewals; ticket summary; warranty expiry; low stock
- Date filters; export CSV/Excel/PDF

### 16. Audit Log — every create/update/delete: who, entity, before/after diff, when. Read-only page with filters

### 17. Settings
- Company profile (name, logo, currency, timezone default Asia/Kolkata, date format DD-MM-YYYY)
- Asset tag prefixes per type, depreciation defaults
- Category management (expense, ticket, asset types)
- Reminder defaults, SMTP settings + test-email button
- App user accounts and roles
- Backup: export full DB as JSON/CSV zip

### 18. Global
- Ctrl/Cmd+K command palette across assets, employees, tickets, subscriptions, invoices
- Indian currency formatting (₹1,23,456.00)
- Every list: search, filter, sort, pagination, CSV export, empty states with CTAs, loading skeletons
- Soft delete (deletedAt) for core entities; nothing hard-deleted from the UI
- Money stored as Decimal, never float

## Database (Prisma) — core models
User, Employee, Department, Location, Vendor, AssetType, Asset, AssetAssignment, MaintenanceRecord, InventoryItem,
StockMovement, Subscription, SubscriptionPayment, License, LicenseSeat, Expense, ExpenseCategory, Document, Ticket,
TicketComment, TicketCategory, Reminder, Notification, AuditLog, Setting.
- cuid IDs, createdAt/updatedAt everywhere, deletedAt for soft delete
- Indexes: serialNumber, assetTag, ticketNumber, invoiceNumber, email
- Seed with realistic Indian sample data (employees, 30 assets, 5+ subscriptions incl. Airtel/Jio WiFi and an AWS server, tickets, expenses)

## UI / Design system — light, minimal, modern, professional
LIGHT theme only. Clean, calm, premium (Linear, Notion, Stripe Dashboard, Attio). Lots of white space, few colours, sharp typography.

### Principles
- Minimal; no decorative gradients, heavy shadows or clutter
- Colour only for meaning (status, priority, alerts) and primary actions
- Hierarchy via typography and spacing, not boxes everywhere
- Consistent spacing, radius and patterns; data-dense but breathable

### Colour tokens (central theme file; never hardcode)
- bg-app #F7F7F5 · bg-surface #FFFFFF · bg-subtle #F2F2EF · bg-muted #EAEAE6
- border #E6E6E1 · border-strong #D4D4CE
- text-primary #111111 · text-secondary #5F5F5A · text-muted #8F8F89
- primary #111111 (white text) · primary-hover #2B2B2B
- accent #A3D93B (sparingly: active nav indicator, key highlights, urgent card stripe, progress bars, charts) · accent-soft #F1F9E2 · accent-text #4D6B12
- Status (soft bg / strong text): success #EAF7EE/#1E7A3C · warning #FFF6E0/#8A5A00 · danger #FDECEC/#B42318 · info #EAF2FF/#1D4ED8 · neutral #F2F2EF/#5F5F5A
- Priority dots: Low #9CA3AF · Medium #3B82F6 · High #F59E0B · Critical #EF4444

### Typography
- Inter (or Plus Jakarta Sans) via next/font; "cv11", "ss01"; tabular numbers for tables and money
- Page title 24/600/-0.01em · Section title 15/600 · Body 14/400 text-secondary
- Table text 13.5px; header 12px/500/muted, uppercase, 0.04em
- Stat numbers 28–32/600/tabular, muted label above, trend pill beside
- Max 2 font weights per card

### Shape, spacing, elevation
- Radius 8 (inputs, buttons, chips) · 12 (cards, tables) · 16 (modals, side panels) · full (avatars, pills)
- 4px scale; page padding 32 desktop / 16 mobile; card padding 20; card gap 16
- Cards flat with 1px border. Shadows only on floating elements: popovers `0 4px 16px rgba(17,17,17,.08)`, modals/panels `0 16px 48px rgba(17,17,17,.12)`
- Max content width 1440px, centred

### Layout
- Sidebar 240px, white, right border. Logo + name; groups: Overview (Dashboard) · Assets (Assets, Assignments, Inventory, Licenses, Maintenance) · Finance (Subscriptions, Expenses, Invoices) · Work (Tickets, Reminders) · Directory (Employees, Vendors) · Insights (Reports, Audit Log) · Settings. Item 36px, 8px radius, 18px lucide icon stroke 1.75. Hover bg-subtle; active bg-subtle + weight 500 + 3px lime bar on the left. Collapsible to a 64px rail (remembered). Bottom: user card
- Top bar 64px: breadcrumbs left; "Search… ⌘K", bell with badge, "+ New" dropdown (primary) right
- Page header: title + muted description left; actions right (secondaries then one primary); tabs/filter bar below
- Detail view: right slide-over 560px with "Open full page" link

### Components (shadcn/ui restyled)
- Button: primary / secondary / ghost / danger; heights 32/36/40; 8px icon gap
- Inputs 36px, white, 1px border, 8px radius; focus border text-primary + 3px ring rgba(17,17,17,.06); labels 13/500 above; helper/error below
- Card: white, border, 12px radius, optional header (title + action link)
- Stat card: muted label, big number, trend pill, small accent sparkline
- Table: white card, sticky header on bg-app, 48px rows, hover bg-subtle, checkbox bulk column, "⋯" row menu on hover, column toggle, pagination, empty state, skeleton rows
- Status pill: full radius, 12/500, soft bg + strong text, optional 6px dot
- Avatar: initials on tinted bg; overlapping stacks
- Tabs: underline (2px text-primary)
- Filter bar: search, filter chips with popovers, "Clear all", saved views
- Empty states: line icon, title, muted description, primary CTA
- Toasts bottom-right, white, border, small status icon
- Command palette ⌘K: centred, grouped, keyboard navigable
- Kanban: muted column headers with count; white cards with priority dot, mono ticket number, requester avatar, due date
- Charts: dashed light horizontal grid only, muted axes, lime main series then greys/soft blue, rounded bar tops, white tooltip card

### Dashboard layout
1. Greeting ("Good afternoon, <name>") + date; quick actions right
2. 4–6 stat cards (Total Assets, Assigned, In Stock, Open Tickets, This Month Spend, Renewals in 30 days)
3. "Upcoming payments & renewals" (wide) + "My open tickets". ≤7 days → thin lime left stripe; overdue → red "Overdue" pill
4. Monthly IT spend chart (wide) + assets by status donut
5. Warranty expiring soon + Low stock + Recent activity

### Motion
150–200ms ease-out hovers; slide-overs 250ms; no bounce; skeletons not spinners; respect prefers-reduced-motion

### Responsive
≥1280 full sidebar · tablet collapsed rail · mobile drawer from top-bar menu, tables → stacked cards, slide-overs → full-screen sheets, "+ New" → FAB

### Accessibility & polish
WCAG AA (check muted text on off-white); visible focus rings; full keyboard nav; aria-labels on icon buttons;
₹1,23,456.00 with tabular numbers; dates as 15 Oct 2026; no lorem ipsum — use seed data

## Build phases (stop after each for review)
1. Setup, design system/tokens, base components (Button, Card, Chip, Avatar, StatNumber, SectionHeader, DataTable, Modal, SlideOver, FormFields), app shell, auth, Prisma schema, seed
2. Employees, Departments, Locations, Vendors, Asset Types (master data)
3. Assets + Assignments/History + QR labels + handover PDFs
4. Subscriptions + payments + Expenses + Documents/Invoices
5. Reminders, notifications, cron, email
6. Tickets (quick add, Kanban, timeline) + Maintenance
7. Inventory/Stock + Licenses
8. Dashboard (real data), Reports, Audit log, Global search, Settings
9. Polish: empty states, skeletons, error boundaries, mobile, README

## Quality rules
- TypeScript strict, no `any`; zod on every server action
- Role checks on every server action (VIEWER read-only)
- Every mutation writes to AuditLog
- Small reusable components; folder by feature (`src/features/assets`, …)
- After each phase: type-check + lint clean
- `.env.example` with every variable explained
