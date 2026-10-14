const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.use(authenticate);

// GET /api/expenses?category=&department=&location=&from=&to=&asset_no=
router.get('/', async (req, res) => {
  const { category, department, location, from, to, asset_no } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (category) { conditions.push(`e.category = $${i++}`); values.push(category); }
  if (department) { conditions.push(`e.department = $${i++}`); values.push(department); }
  if (location) { conditions.push(`e.location = $${i++}`); values.push(location); }
  if (from) { conditions.push(`e.expense_date >= $${i++}`); values.push(from); }
  if (to) { conditions.push(`e.expense_date <= $${i++}`); values.push(to); }
  if (asset_no) { conditions.push(`a.asset_no = $${i++}`); values.push(asset_no); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT e.*, a.asset_no FROM expenses e LEFT JOIN assets a ON a.id = e.asset_id ${where}
     ORDER BY e.expense_date DESC`,
    values
  );
  res.json(rows);
});

// POST /api/expenses
router.post('/', upload.single('attachment'), async (req, res) => {
  const { asset_no, expense_date, category, description, amount, vendor, paid_by, department, location } = req.body;
  if (!expense_date || !category || !amount) {
    return res.status(400).json({ error: 'expense_date, category and amount are required' });
  }

  let asset_id = null;
  if (asset_no) {
    const a = await pool.query('SELECT id FROM assets WHERE asset_no = $1', [asset_no]);
    if (a.rows.length) asset_id = a.rows[0].id;
  }

  const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;

  const { rows } = await pool.query(
    `INSERT INTO expenses (asset_id, expense_date, category, description, amount, vendor,
      paid_by, attachment_url, department, location, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [asset_id, expense_date, category, description, amount, vendor, paid_by,
     attachment_url, department, location, req.user.id]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/expenses/:id
router.put('/:id', authorize('admin', 'it_support'), async (req, res) => {
  const fields = ['expense_date', 'category', 'description', 'amount', 'vendor', 'paid_by', 'department', 'location'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE expenses SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
  );
  if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
  res.json(rows[0]);
});

// DELETE /api/expenses/:id
router.delete('/:id', authorize('admin', 'it_support'), async (req, res) => {
  const { rows } = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).send();
});

// GET /api/expenses/reports/summary?groupBy=month|category|department|location&year=2026
router.get('/reports/summary', async (req, res) => {
  const { groupBy = 'month', year } = req.query;
  const values = [];
  let where = '';
  if (year) { where = 'WHERE EXTRACT(YEAR FROM expense_date) = $1'; values.push(year); }

  const groupExpr = {
    month: `TO_CHAR(expense_date, 'YYYY-MM')`,
    category: 'category',
    department: 'department',
    location: 'location',
  }[groupBy] || `TO_CHAR(expense_date, 'YYYY-MM')`;

  const { rows } = await pool.query(
    `SELECT ${groupExpr} AS key, SUM(amount) AS total, COUNT(*) AS count
     FROM expenses ${where} GROUP BY key ORDER BY key`,
    values
  );
  res.json(rows);
});

module.exports = router;
