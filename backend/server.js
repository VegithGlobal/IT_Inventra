require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const expenseRoutes = require('./routes/expenses');
const ticketRoutes = require('./routes/tickets');
const userRoutes = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
