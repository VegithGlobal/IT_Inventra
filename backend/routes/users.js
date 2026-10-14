const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/users  (admin, it_support)
router.get('/', authorize('admin', 'it_support'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, department, location, active FROM users ORDER BY name'
  );
  res.json(rows);
});

// PUT /api/users/:id  (admin only - change role/department/active)
router.put('/:id', authorize('admin'), async (req, res) => {
  const fields = ['name', 'role', 'department', 'location', 'active'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, department, active`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// PUT /api/users/:id/password  (self or admin)
router.put('/:id/password', async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
  res.json({ success: true });
});

module.exports = router;
