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

async function nextTicketNo() {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM tickets`);
  const n = Number(rows[0].count) + 1;
  return `TKT-${String(n).padStart(5, '0')}`;
}

// GET /api/tickets?status=&category=&priority=&assigned_to=&mine=true
router.get('/', async (req, res) => {
  const { status, category, priority, assigned_to, mine } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (status) { conditions.push(`t.status = $${i++}`); values.push(status); }
  if (category) { conditions.push(`t.category = $${i++}`); values.push(category); }
  if (priority) { conditions.push(`t.priority = $${i++}`); values.push(priority); }
  if (assigned_to) { conditions.push(`t.assigned_to = $${i++}`); values.push(assigned_to); }
  if (mine === 'true') { conditions.push(`t.raised_by = $${i++}`); values.push(req.user.id); }
  // employees only ever see their own tickets
  if (req.user.role === 'employee') { conditions.push(`t.raised_by = $${i++}`); values.push(req.user.id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS raised_by_name, a.asset_no,
            au.name AS assigned_to_name
     FROM tickets t
     JOIN users u ON u.id = t.raised_by
     LEFT JOIN assets a ON a.id = t.asset_id
     LEFT JOIN users au ON au.id = t.assigned_to
     ${where} ORDER BY t.created_at DESC`,
    values
  );
  res.json(rows);
});

// GET /api/tickets/:ticketNo
router.get('/:ticketNo', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS raised_by_name, a.asset_no, au.name AS assigned_to_name
     FROM tickets t
     JOIN users u ON u.id = t.raised_by
     LEFT JOIN assets a ON a.id = t.asset_id
     LEFT JOIN users au ON au.id = t.assigned_to
     WHERE t.ticket_no = $1`,
    [req.params.ticketNo]
  );
  if (!rows.length) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'employee' && rows[0].raised_by !== req.user.id) {
    return res.status(403).json({ error: 'Not your ticket' });
  }

  const comments = await pool.query(
    `SELECT c.*, u.name AS user_name FROM ticket_comments c
     JOIN users u ON u.id = c.user_id WHERE c.ticket_id = $1 ORDER BY c.created_at ASC`,
    [rows[0].id]
  );
  res.json({ ...rows[0], comments: comments.rows });
});

// POST /api/tickets  (any authenticated user)
router.post('/', upload.single('attachment'), async (req, res) => {
  const { category, asset_no, description, priority } = req.body;
  if (!category || !description) return res.status(400).json({ error: 'category and description are required' });

  let asset_id = null;
  if (asset_no) {
    const a = await pool.query('SELECT id FROM assets WHERE asset_no = $1', [asset_no]);
    if (a.rows.length) asset_id = a.rows[0].id;
  }

  const ticket_no = await nextTicketNo();
  const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;

  const { rows } = await pool.query(
    `INSERT INTO tickets (ticket_no, raised_by, category, asset_id, description, priority, attachment_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [ticket_no, req.user.id, category, asset_id, description, priority || 'Medium', attachment_url]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/tickets/:ticketNo  (status / assignment / priority - admin, it_support)
router.put('/:ticketNo', authorize('admin', 'it_support'), async (req, res) => {
  const { status, assigned_to, priority } = req.body;
  const updates = [];
  const values = [];
  let i = 1;
  if (status) { updates.push(`status = $${i++}`); values.push(status); }
  if (assigned_to !== undefined) { updates.push(`assigned_to = $${i++}`); values.push(assigned_to); }
  if (priority) { updates.push(`priority = $${i++}`); values.push(priority); }
  if (status === 'Resolved' || status === 'Closed') { updates.push(`resolved_at = NOW()`); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.ticketNo);

  const { rows } = await pool.query(
    `UPDATE tickets SET ${updates.join(', ')} WHERE ticket_no = $${i} RETURNING *`, values
  );
  if (!rows.length) return res.status(404).json({ error: 'Ticket not found' });
  res.json(rows[0]);
});

// POST /api/tickets/:ticketNo/comments
router.post('/:ticketNo/comments', async (req, res) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment is required' });

  const t = await pool.query('SELECT id FROM tickets WHERE ticket_no = $1', [req.params.ticketNo]);
  if (!t.rows.length) return res.status(404).json({ error: 'Ticket not found' });

  const { rows } = await pool.query(
    'INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES ($1,$2,$3) RETURNING *',
    [t.rows[0].id, req.user.id, comment]
  );
  res.status(201).json(rows[0]);
});

// GET /api/tickets/dashboard/summary
router.get('/dashboard/summary', async (req, res) => {
  const byStatus = await pool.query('SELECT status, COUNT(*) FROM tickets GROUP BY status');
  const byCategory = await pool.query('SELECT category, COUNT(*) FROM tickets GROUP BY category');
  const avgResolution = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) AS avg_hours
     FROM tickets WHERE resolved_at IS NOT NULL`
  );
  res.json({
    by_status: byStatus.rows,
    by_category: byCategory.rows,
    avg_resolution_hours: Number(avgResolution.rows[0].avg_hours) || 0,
  });
});

module.exports = router;
