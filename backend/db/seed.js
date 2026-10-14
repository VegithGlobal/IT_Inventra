/**
 * Seed script:
 * 1. Creates default users (admin / it_support / employee) with bcrypt-hashed passwords.
 * 2. Imports asset data from data/All_Assets_List.xlsx (sheet: "ALl Asset List") into `assets`.
 * 3. Also imports "peripheral devices" sheet, tagged with their own asset types.
 *
 * Run: npm run seed   (after running schema.sql against your database)
 */
require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const pool = require('../config/db');

const FILE_PATH = path.join(__dirname, '..', 'data', 'All_Assets_List.xlsx');

async function seedUsers() {
  const users = [
    { name: 'Admin User', email: 'admin@company.com', password: 'Admin@123', role: 'admin' },
    { name: 'IT Support', email: 'itsupport@company.com', password: 'ItSupport@123', role: 'it_support' },
    { name: 'Demo Employee', email: 'employee@company.com', password: 'Employee@123', role: 'employee' },
  ];
  for (const u of users) {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (exists.rows.length) continue;
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)',
      [u.name, u.email, hash, u.role]
    );
    console.log(`Created user ${u.email} / ${u.password}`);
  }
}

function normStatus(raw) {
  if (!raw) return 'In Stock';
  const s = raw.toString().trim().toLowerCase();
  if (s.includes('lost')) return 'Lost';
  if (s.includes('damage')) return 'Damaged';
  if (s.includes('repair')) return 'Under Repair';
  if (s.includes('dispos')) return 'Disposed';
  if (s.includes('use')) return 'In Use';
  if (s.includes('stock')) return 'In Stock';
  return 'In Stock';
}

async function importSheet(sheetName, workbook, defaultType) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { console.log(`Sheet "${sheetName}" not found, skipping`); return; }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  let count = 0;
  for (const r of rows) {
    const asset_no = (r['Asset no.'] || '').toString().trim();
    if (!asset_no) continue;

    const exists = await pool.query('SELECT id FROM assets WHERE asset_no = $1', [asset_no]);
    if (exists.rows.length) continue; // avoid dupes if same asset appears in multiple sheets

    const asset_type = (r['Asset Type'] || defaultType || 'Other').toString().trim();
    const company = r['Company'] ? r['Company'].toString().trim() : null;
    const brand = r['Brand'] || null;
    const model = r['Model'] || null;
    const serial_number = r['Serial Number'] || r['MLPL_DESK_05 /GGPF1R1 '] || null;
    const processor = r['Processor'] || null;
    const ram = r['RAM (GB)'] || null;
    const storage = r['1 TB HDD'] || null;
    const status = normStatus(r['Current Status']);
    const current_user_name = r['Current User Name'] ? r['Current User Name'].toString().trim() : null;
    const department = r['Department'] || null;
    const location = r['Location'] || null;
    const remark = r['Remark'] || null;
    const condition_report = r['Condition Report '] || r['Condition Report'] || null;
    const pastUsers = r['Past User Names'] || null;

    const inserted = await pool.query(
      `INSERT INTO assets (asset_no, asset_type, company, brand, model, serial_number,
        processor, ram, storage, status, current_user_name, department, location,
        condition_report, remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [asset_no, asset_type, company, brand, model, serial_number, processor, ram, storage,
       status, current_user_name, department, location, condition_report, remark]
    );
    const assetId = inserted.rows[0].id;

    // seed past-user history (informational, all marked returned) then current as open record
    if (pastUsers) {
      const names = pastUsers.toString().split('/').map((n) => n.trim()).filter(Boolean);
      for (const n of names) {
        await pool.query(
          `INSERT INTO asset_user_history (asset_id, user_name, assigned_on, returned_on, remark)
           VALUES ($1,$2, NOW(), NOW(), 'Imported from legacy register')`,
          [assetId, n]
        );
      }
    }
    if (current_user_name) {
      await pool.query(
        `INSERT INTO asset_user_history (asset_id, user_name, remark) VALUES ($1,$2,'Current holder - imported')`,
        [assetId, current_user_name]
      );
    }

    count++;
  }
  console.log(`Imported ${count} assets from "${sheetName}"`);
}

async function main() {
  console.log('Seeding database...');
  await seedUsers();

  const workbook = XLSX.readFile(FILE_PATH);
  console.log('Sheets found:', workbook.SheetNames);

  await importSheet('ALl Asset List', workbook, null);
  await importSheet('peripheral devices', workbook, 'Peripheral');

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
