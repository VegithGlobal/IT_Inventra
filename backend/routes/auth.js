const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
  });
});

// POST /api/auth/register  (admin only in practice; open here for first-run setup)
router.post('/register', async (req, res) => {
  const { name, email, password, role, department, location } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department, location)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role`,
    [name, email, hash, role || 'employee', department, location]
  );
  res.status(201).json(rows[0]);
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, department, location FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json(rows[0]);
});

module.exports = router;
