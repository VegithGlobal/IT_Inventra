# IT Asset & Expense Management System

Full-stack app: React + Vite + Tailwind (frontend), Node/Express (backend), PostgreSQL (database).
Modules: Asset Management, Expense Management, Ticketing.

## 1. Database setup
```bash
createdb asset_management
psql asset_management -f backend/db/schema.sql
```

## 2. Backend setup
```bash
cd backend
cp .env.example .env      # edit DATABASE_URL + JWT_SECRET
npm install
npm run seed               # loads demo users + imports data/All_Assets_List.xlsx
npm run dev                # runs on http://localhost:5000
```
Your real asset data (from your uploaded Excel) is already placed at `backend/data/All_Assets_List.xlsx`
and will be imported by `npm run seed` — sheets "ALl Asset List" and "peripheral devices".

Demo logins created by seed:
| Role       | Email                  | Password       |
|------------|------------------------|----------------|
| admin      | admin@company.com      | Admin@123      |
| it_support | itsupport@company.com  | ItSupport@123  |
| employee   | employee@company.com   | Employee@123   |

**Change these passwords immediately after first login in production.**

## 3. Frontend setup
```bash
cd frontend
npm install
npm run dev                 # runs on http://localhost:3000, proxies /api to :5000
```

## 4. Project structure
```
backend/
  config/db.js          Postgres pool
  db/schema.sql          Full DB schema (tables, indexes, triggers)
  db/seed.js              Seeds users + imports your Excel asset data
  middleware/auth.js     JWT auth + role-based authorize()
  routes/                auth, assets, expenses, tickets, users
  server.js               Express entrypoint
frontend/
  src/pages/               Dashboard, Assets, AssetDetail, Expenses, Tickets, TicketDetail, Users, Login
  src/api/                  axios client + AuthContext
  src/components/Layout.jsx Sidebar nav
```

## 5. Key REST endpoints
```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/assets?type=&status=&location=&department=&user=&search=
GET    /api/assets/:assetNo          (detail + history + linked expenses)
POST   /api/assets
PUT    /api/assets/:assetNo
POST   /api/assets/:assetNo/transfer  { new_user_name, remark }
DELETE /api/assets/:assetNo
GET    /api/assets/dashboard/summary

GET    /api/expenses?category=&department=&location=&from=&to=&asset_no=
POST   /api/expenses          (multipart, field: attachment)
PUT    /api/expenses/:id
DELETE /api/expenses/:id
GET    /api/expenses/reports/summary?groupBy=month|category|department|location&year=

GET    /api/tickets?status=&category=&priority=&mine=true
GET    /api/tickets/:ticketNo
POST   /api/tickets            (multipart, field: attachment)
PUT    /api/tickets/:ticketNo   { status, assigned_to, priority }
POST   /api/tickets/:ticketNo/comments
GET    /api/tickets/dashboard/summary

GET    /api/users
PUT    /api/users/:id
PUT    /api/users/:id/password
```

## 6. Next steps / production notes
- Add PDF/Excel export on expense reports (use `exceljs` / `pdfkit`)
- Add email notifications on ticket status change (nodemailer)
- Move file uploads to S3/Cloud storage instead of local disk
- Add rate limiting + helmet for production hardening
- Generate QR codes per asset (use `qrcode` npm package) for physical tagging
