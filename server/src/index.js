require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { initDb, db } = require('./db');
const { generateToken, verifyToken, requireOwner } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// USERS & AGENTS (Owner Only)
app.get('/api/users', verifyToken, requireOwner, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

app.post('/api/users', verifyToken, requireOwner, async (req, res) => {
  try {
    const { name, username, password, role, phone } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'Name, username, password, and role are required' });
    }

    const existing = await db.findUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const newUser = await db.createUser({ name, username, password, role, phone });
    return res.status(201).json({ user: newUser });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// CLIENTS
app.get('/api/clients', verifyToken, async (req, res) => {
  try {
    const clients = await db.getAllClients();
    return res.json({ clients });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

app.post('/api/clients', verifyToken, async (req, res) => {
  try {
    const { name, phone, nic_id, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Client name and phone number are required' });
    }

    const newClient = await db.createClient({
      name,
      phone,
      nic_id: nic_id || '',
      address: address || '',
      notes: notes || '',
      created_by: req.user.id
    });
    return res.status(201).json({ client: newClient });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register client' });
  }
});

app.get('/api/clients/:id', verifyToken, async (req, res) => {
  try {
    const client = await db.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    return res.json({ client });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

// LOANS (58 Installment Engine)
app.get('/api/loans', verifyToken, async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;

    // If logged in as field collection agent, filter to their assigned loans or show active collection queue
    if (req.user.role === 'AGENT') {
      filters.agent_id = req.user.id;
    } else if (req.query.agent_id) {
      filters.agent_id = req.query.agent_id;
    }

    const loans = await db.getAllLoans(filters);
    return res.json({ loans });
  } catch (err) {
    console.error('Error fetching loans:', err);
    return res.status(500).json({ error: 'Failed to retrieve loans' });
  }
});

app.get('/api/loans/:id', verifyToken, async (req, res) => {
  try {
    const loan = await db.getLoanById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    return res.json({ loan });
  } catch (err) {
    console.error('Error fetching loan detail:', err);
    return res.status(500).json({ error: 'Failed to retrieve loan details' });
  }
});

app.post('/api/loans', verifyToken, async (req, res) => {
  try {
    const {
      client_id,
      assigned_agent_id,
      principal_amount,
      interest_rate_pct = 8.00,
      installment_count = 58,
      frequency = 'DAILY',
      start_date
    } = req.body;

    if (!client_id || !principal_amount) {
      return res.status(400).json({ error: 'Client and principal amount are required' });
    }

    if (parseFloat(principal_amount) <= 0) {
      return res.status(400).json({ error: 'Principal amount must be positive' });
    }

    const newLoan = await db.createLoan({
      client_id,
      created_by: req.user.id,
      assigned_agent_id: assigned_agent_id || (req.user.role === 'AGENT' ? req.user.id : null),
      principal_amount,
      interest_rate_pct: parseFloat(interest_rate_pct) || 8.00,
      installment_count: parseInt(installment_count, 10) || 58,
      frequency: frequency || 'DAILY',
      start_date: start_date || new Date().toISOString().split('T')[0]
    });

    return res.status(201).json({ loan: newLoan });
  } catch (err) {
    console.error('Error creating loan:', err);
    return res.status(500).json({ error: err.message || 'Failed to create loan' });
  }
});

// PAYMENTS & RECEIPT PRINTING (Full & Partial Payments)
app.post('/api/payments', verifyToken, async (req, res) => {
  try {
    const { loan_id, amount_paid, payment_method, notes } = req.body;

    if (!loan_id || !amount_paid) {
      return res.status(400).json({ error: 'Loan ID and payment amount are required' });
    }

    const parsedAmount = parseFloat(amount_paid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const paymentResult = await db.recordPayment({
      loan_id,
      collector_id: req.user.id,
      amount_paid: parsedAmount,
      payment_method: payment_method || 'CASH',
      notes: notes || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      receipt: paymentResult
    });
  } catch (err) {
    console.error('Error processing payment:', err);
    return res.status(400).json({ error: err.message || 'Payment processing failed' });
  }
});

// LEAN REMINDERS (Zero Cloud Storage Bloat)
app.get('/api/reminders', verifyToken, async (req, res) => {
  try {
    const reminders = await db.getReminders(req.user.id, req.user.role);
    return res.json(reminders);
  } catch (err) {
    console.error('Error calculating reminders:', err);
    return res.status(500).json({ error: 'Failed to compute reminders' });
  }
});

// DASHBOARD FINANCIAL METRICS (Owner & Collection Summary)
app.get('/api/dashboard', verifyToken, async (req, res) => {
  try {
    const metrics = await db.getDashboardMetrics();
    const reminders = await db.getReminders(req.user.id, req.user.role);
    return res.json({
      metrics,
      due_today_count: reminders.due_today_count,
      overdue_count: reminders.overdue_count
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});

const path = require('path');
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start server
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Loan Management Server running on port ${PORT}`);
    console.log(`- Web App & API available at: http://localhost:${PORT}`);
    console.log(`- PostgreSQL Engine: ${db.isPostgres() ? 'Active (Cloud/PG)' : 'Ready (Using Local file storage fallback)'}`);
  });
}

start();

