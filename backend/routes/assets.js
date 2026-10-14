const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/assets?type=&status=&location=&department=&user=&search=
router.get('/', async (req, res) => {
  const { type, status, location, department, user, search } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (type) { conditions.push(`asset_type = $${i++}`); values.push(type); }
  if (status) { conditions.push(`status = $${i++}`); values.push(status); }
  if (location) { conditions.push(`location = $${i++}`); values.push(location); }
  if (department) { conditions.push(`department = $${i++}`); values.push(department); }
  if (user) { conditions.push(`current_user_name ILIKE $${i++}`); values.push(`%${user}%`); }
  if (search) {
    conditions.push(`(asset_no ILIKE $${i} OR brand ILIKE $${i} OR model ILIKE $${i} OR serial_number ILIKE $${i})`);
    values.push(`%${search}%`); i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM assets ${where} ORDER BY id DESC`, values);
  res.json(rows);
});

// GET /api/assets/:assetNo  (detail + history + linked expenses)
router.get('/:assetNo', async (req, res) => {
  const { assetNo } = req.params;
  const assetRes = await pool.query('SELECT * FROM assets WHERE asset_no = $1', [assetNo]);
  if (!assetRes.rows.length) return res.status(404).json({ error: 'Asset not found' });
  const asset = assetRes.rows[0];

  const history = await pool.query(
    'SELECT * FROM asset_user_history WHERE asset_id = $1 ORDER BY assigned_on DESC',
    [asset.id]
  );
  const expenses = await pool.query(
    'SELECT * FROM expenses WHERE asset_id = $1 ORDER BY expense_date DESC',
    [asset.id]
  );
  const totalCost = expenses.rows.reduce((s, e) => s + Number(e.amount), 0);

  res.json({ ...asset, history: history.rows, expenses: expenses.rows, total_maintenance_cost: totalCost });
});

// POST /api/assets  (admin, it_support)
router.post('/', authorize('admin', 'it_support'), async (req, res) => {
  const {
    asset_no, asset_type, company, brand, model, serial_number,
    processor, ram, storage, status, current_user_name,
    department, location, inventory_flag, condition_report, remark,
  } = req.body;

  if (!asset_no || !asset_type) return res.status(400).json({ error: 'asset_no and asset_type are required' });

  const { rows } = await pool.query(
    `INSERT INTO assets (asset_no, asset_type, company, brand, model, serial_number,
      processor, ram, storage, status, current_user_name, department, location,
      inventory_flag, condition_report, remark)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [asset_no, asset_type, company, brand, model, serial_number, processor, ram, storage,
     status || 'In Stock', current_user_name, department, location,
     inventory_flag !== undefined ? inventory_flag : true, condition_report, remark]
  );

  if (current_user_name) {
    await pool.query(
      'INSERT INTO asset_user_history (asset_id, user_name, remark) VALUES ($1,$2,$3)',
      [rows[0].id, current_user_name, 'Initial assignment']
    );
  }

  res.status(201).json(rows[0]);
});

// PUT /api/assets/:assetNo  (admin, it_support) - general field update
router.put('/:assetNo', authorize('admin', 'it_support'), async (req, res) => {
  const { assetNo } = req.params;
  const fields = [
    'asset_type', 'company', 'brand', 'model', 'serial_number', 'processor', 'ram',
    'storage', 'status', 'department', 'location', 'inventory_flag', 'condition_report', 'remark',
  ];
  const updates = [];
  const values = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(assetNo);

  const { rows } = await pool.query(
    `UPDATE assets SET ${updates.join(', ')} WHERE asset_no = $${i} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
  res.json(rows[0]);
});

// POST /api/assets/:assetNo/transfer  { new_user_name, remark } -> logs history, updates current user
router.post('/:assetNo/transfer', authorize('admin', 'it_support'), async (req, res) => {
  const { assetNo } = req.params;
  const { new_user_name, remark } = req.body;
  if (!new_user_name) return res.status(400).json({ error: 'new_user_name is required' });

  const assetRes = await pool.query('SELECT * FROM assets WHERE asset_no = $1', [assetNo]);
  if (!assetRes.rows.length) return res.status(404).json({ error: 'Asset not found' });
  const asset = assetRes.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // close out the currently open history record (no returned_on yet)
    await client.query(
      `UPDATE asset_user_history SET returned_on = NOW()
       WHERE asset_id = $1 AND returned_on IS NULL`,
      [asset.id]
    );
    // new history record
    await client.query(
      'INSERT INTO asset_user_history (asset_id, user_name, remark) VALUES ($1,$2,$3)',
      [asset.id, new_user_name, remark || null]
    );
    // update asset
    const updated = await client.query(
      `UPDATE assets SET current_user_name = $1, status = 'In Use' WHERE id = $2 RETURNING *`,
      [new_user_name, asset.id]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/assets/:assetNo  (admin only)
router.delete('/:assetNo', authorize('admin'), async (req, res) => {
  const { rows } = await pool.query('DELETE FROM assets WHERE asset_no = $1 RETURNING id', [req.params.assetNo]);
  if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
  res.status(204).send();
});

// GET /api/assets/dashboard/summary
router.get('/dashboard/summary', async (req, res) => {
  const byStatus = await pool.query('SELECT status, COUNT(*) FROM assets GROUP BY status');
  const byLocation = await pool.query('SELECT location, COUNT(*) FROM assets GROUP BY location');
  const byDepartment = await pool.query('SELECT department, COUNT(*) FROM assets GROUP BY department');
  const total = await pool.query('SELECT COUNT(*) FROM assets');
  res.json({
    total: Number(total.rows[0].count),
    by_status: byStatus.rows,
    by_location: byLocation.rows,
    by_department: byDepartment.rows,
  });
});

module.exports = router;
