require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDb, db } = require('./db');
const { generateToken, verifyToken, requireOwner, requirePermission } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy for accurate IP detection behind Render & Netlify
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS policy - Live production allowed for apex.org.lk, Netlify, and local development seamlessly
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit 15 failed/login requests per 15 mins per IP
  message: { error: 'Too many login attempts from this network. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500, // 1500 requests per 15 minutes
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// AUTH ROUTES
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
      await db.logAudit({
        username: username.slice(0, 50),
        role: 'VISITOR',
        action: 'LOGIN_FAILED',
        details: 'User does not exist',
        ip_address: clientIp
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      await db.logAudit({
        user_id: user.id,
        username: user.username,
        role: user.role,
        action: 'LOGIN_FAILED',
        details: 'Incorrect password',
        ip_address: clientIp
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      await db.logAudit({
        user_id: user.id,
        username: user.username,
        role: user.role,
        action: 'LOGIN_BLOCKED',
        details: 'Account suspended/inactive',
        ip_address: clientIp
      });
      return res.status(403).json({ error: 'Your account has been deactivated or suspended by the business owner.' });
    }

    let userPerms = [];
    if (Array.isArray(user.permissions)) {
      userPerms = user.permissions;
    } else if (typeof user.permissions === 'string') {
      try { userPerms = JSON.parse(user.permissions); } catch(e) { userPerms = []; }
    } else if (user.role === 'OWNER') {
      userPerms = ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS', 'TOPUP_LOANS', 'MANAGE_USERS'];
    } else {
      userPerms = ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS'];
    }

    const token = generateToken({ ...user, permissions: userPerms });

    await db.logAudit({
      user_id: user.id,
      username: user.username,
      role: user.role,
      action: 'LOGIN_SUCCESS',
      details: `Role: ${user.role}`,
      ip_address: clientIp
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone,
        status: user.status || 'ACTIVE',
        permissions: userPerms
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

// HEALTH CHECK & VERSION
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', version: '1.1.0', time: new Date().toISOString() });
});

// USERS & AGENTS (Owner Only)
app.get('/api/users', verifyToken, requireOwner, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    return res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

app.post('/api/users', verifyToken, requireOwner, async (req, res) => {
  try {
    const { name, username, password, role, phone, permissions, status } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'Name, username, password, and role are required' });
    }

    const existing = await db.findUserByUsername(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const newUser = await db.createUser({
      name: name.trim(),
      username: username.trim(),
      password,
      role,
      phone: phone ? phone.trim() : '',
      permissions,
      status
    });

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'USER_CREATED',
      details: `Created user ${newUser.username} (${newUser.role})`,
      ip_address: req.ip
    });

    return res.status(201).json({ user: newUser, message: 'User created successfully' });
  } catch (err) {
    console.error('Error creating user:', err);
    return res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

const handleUserUpdate = async (req, res) => {
  try {
    const { name, phone, role, status, permissions, password } = req.body;
    const updated = await db.updateUser(req.params.id, {
      name, phone, role, status, permissions, password
    });

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'USER_UPDATED',
      details: `Updated user #${req.params.id} (${updated.username}) status: ${updated.status}`,
      ip_address: req.ip
    });

    return res.json({ user: updated, message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(400).json({ error: err.message || 'Failed to update user' });
  }
};

app.put('/api/users/:id', verifyToken, requireOwner, handleUserUpdate);
app.post('/api/users/:id/update', verifyToken, requireOwner, handleUserUpdate);

const handleUserDelete = async (req, res) => {
  try {
    await db.deleteUser(req.params.id, req.user.id);

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'USER_DELETED',
      details: `Deleted user #${req.params.id}`,
      ip_address: req.ip
    });

    return res.json({ success: true, message: 'User account deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(400).json({ error: err.message || 'Failed to delete user' });
  }
};

app.delete('/api/users/:id', verifyToken, requireOwner, handleUserDelete);
app.post('/api/users/:id/delete', verifyToken, requireOwner, handleUserDelete);

// CLIENTS
app.get('/api/clients', verifyToken, async (req, res) => {
  try {
    const clients = await db.getAllClients();
    return res.json({ clients });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

app.post('/api/clients', verifyToken, requirePermission('REGISTER_CLIENTS'), async (req, res) => {
  try {
    const {
      name, phone, nic_id, address, notes,
      business_type, kyc_status, kyc_notes, photo_url
    } = req.body;
    if (!name || !name.trim() || !phone || !phone.trim() || !nic_id || !nic_id.trim()) {
      return res.status(400).json({ error: 'Client name, phone number, and NIC are required' });
    }

    const newClient = await db.createClient({
      name,
      phone,
      nic_id: nic_id || '',
      address: address || '',
      notes: notes || '',
      business_type: business_type || '',
      kyc_status: kyc_status || 'VERIFIED',
      kyc_notes: kyc_notes || '',
      photo_url: photo_url || '',
      created_by: req.user.id
    });

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'CLIENT_CREATED',
      details: `Created client ${newClient.name} (NIC: ${newClient.nic_id || 'N/A'})`,
      ip_address: req.ip
    });

    return res.status(201).json({ client: newClient });
  } catch (err) {
    console.error('Error creating client:', err.message);
    return res.status(400).json({ error: err.message || 'Failed to register client' });
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

app.put('/api/clients/:id', verifyToken, async (req, res) => {
  try {
    const {
      name, phone, nic_id, address, notes,
      business_type, kyc_status, kyc_notes, photo_url
    } = req.body;
    const updated = await db.updateClient(req.params.id, {
      name, phone, nic_id, address, notes,
      business_type, kyc_status, kyc_notes, photo_url
    });
    return res.json({ client: updated, message: 'Client updated successfully' });
  } catch (err) {
    console.error('Error updating client:', err.message);
    return res.status(400).json({ error: err.message || 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    await db.deleteClient(req.params.id);

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'CLIENT_DELETED',
      details: `Deleted client #${req.params.id}`,
      ip_address: req.ip
    });

    return res.json({ success: true, message: 'Client and associated loans deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete client' });
  }
});


// LOANS (58 Installment Engine)
app.get('/api/loans', verifyToken, async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;

    // Optional agent filter if explicitly requested via query param ?agent_id=...
    if (req.query.agent_id) {
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

app.post('/api/loans', verifyToken, requirePermission('ISSUE_LOANS'), async (req, res) => {
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

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'LOAN_ISSUED',
      details: `Issued loan ${newLoan.loan_code} Rs. ${newLoan.principal_amount} for Client #${client_id}`,
      ip_address: req.ip
    });

    return res.status(201).json({ loan: newLoan });
  } catch (err) {
    console.error('Error creating loan:', err);
    return res.status(500).json({ error: err.message || 'Failed to create loan' });
  }
});

// UPDATE / TOP-UP LOAN
app.put('/api/loans/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    const { principal_amount, topup_amount, interest_rate_pct, assigned_agent_id, status } = req.body;
    const updated = await db.updateLoan(req.params.id, {
      principal_amount,
      topup_amount,
      interest_rate_pct,
      assigned_agent_id,
      status
    });
    return res.json({ loan: updated, message: 'Loan updated successfully' });
  } catch (err) {
    console.error('Error updating loan:', err);
    return res.status(500).json({ error: err.message || 'Failed to update loan' });
  }
});

// APPLY OVERDUE PENALTY (8% on remaining balance after 58 days)
app.post('/api/loans/:id/penalty', verifyToken, requireOwner, async (req, res) => {
  try {
    const { penalty_pct = 8.0 } = req.body;
    const updated = await db.applyPenalty(req.params.id, penalty_pct);
    return res.json({ loan: updated, message: 'Overdue penalty applied successfully' });
  } catch (err) {
    console.error('Error applying penalty:', err);
    return res.status(500).json({ error: err.message || 'Failed to apply penalty' });
  }
});

// DELETE LOAN
app.delete('/api/loans/:id', verifyToken, requireOwner, async (req, res) => {
  try {
    await db.deleteLoan(req.params.id);

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'LOAN_DELETED',
      details: `Deleted loan #${req.params.id}`,
      ip_address: req.ip
    });

    return res.json({ success: true, message: 'Loan and its installments deleted successfully' });
  } catch (err) {
    console.error('Error deleting loan:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete loan' });
  }
});


// PAYMENTS & RECEIPT PRINTING (Full & Partial Payments)
app.post('/api/payments', verifyToken, requirePermission('COLLECT_PAYMENTS'), async (req, res) => {
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

    await db.logAudit({
      user_id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: 'PAYMENT_COLLECTED',
      details: `Receipt ${paymentResult.receipt_no}: Rs. ${paymentResult.amount_paid} for Loan #${paymentResult.loan_id}`,
      ip_address: req.ip
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

// SYSTEM AUDIT LOGS (Owner Only)
app.get('/api/audit-logs', verifyToken, requireOwner, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = await db.getAuditLogs(limit);
    return res.json({ logs });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs' });
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
      overdue_count: reminders.overdue_count,
      penalties_count: reminders.penalties_count || 0
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});

// MONTHLY FINANCIAL REPORT & ANALYTICS (Owner Only)
app.get('/api/reports/monthly', verifyToken, requireOwner, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const report = await db.getMonthlyReport(month);
    return res.json({ report });
  } catch (err) {
    console.error('Error fetching monthly report:', err);
    return res.status(500).json({ error: 'Failed to load monthly report' });
  }
});

// MASTER TRANSACTIONS & RECEIPTS LEDGER (Owner Only)
app.get('/api/payments', verifyToken, requireOwner, async (req, res) => {
  try {
    const { month, search, payment_method, limit = 200, offset = 0 } = req.query;
    const transactions = await db.getAllTransactions({
      month,
      search,
      payment_method,
      limit: parseInt(limit, 10) || 200,
      offset: parseInt(offset, 10) || 0
    });
    return res.json({ transactions });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    return res.status(500).json({ error: 'Failed to load transactions' });
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

