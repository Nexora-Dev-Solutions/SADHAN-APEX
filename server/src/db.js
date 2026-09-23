const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let pgPool = null;
let usePostgres = false;

// Check if PostgreSQL connection is configured
if (process.env.DATABASE_URL) {
  const isSsl = process.env.DATABASE_SSL === 'true' || 
                process.env.DATABASE_URL.includes('neon.tech') || 
                process.env.DATABASE_URL.includes('sslmode=require');

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSsl ? { rejectUnauthorized: false } : false
  });
}


// In-memory / file fallback store
let localStore = {
  users: [],
  clients: [],
  loans: [],
  installments: [],
  payments: [],
  notifications: []
};

function loadLocalStore() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      localStore = JSON.parse(data);
    } catch (err) {
      console.error('Error loading db.json, using empty store:', err);
    }
  }
}

function saveLocalStore() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

async function initPostgresSchema() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      nic_id VARCHAR(50),
      address TEXT,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      loan_code VARCHAR(30) UNIQUE NOT NULL,
      client_id INT REFERENCES clients(id) ON DELETE CASCADE,
      created_by INT,
      assigned_agent_id INT,
      principal_amount NUMERIC(12, 2) NOT NULL,
      interest_rate_pct NUMERIC(5, 2) DEFAULT 8.00,
      total_interest NUMERIC(12, 2) NOT NULL,
      total_payable NUMERIC(12, 2) NOT NULL,
      installment_count INT DEFAULT 58,
      frequency VARCHAR(20) DEFAULT 'DAILY',
      installment_amount NUMERIC(12, 2) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_paid NUMERIC(12, 2) DEFAULT 0.00,
      remaining_balance NUMERIC(12, 2) NOT NULL,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS installments (
      id SERIAL PRIMARY KEY,
      loan_id INT REFERENCES loans(id) ON DELETE CASCADE,
      installment_no INT NOT NULL,
      due_date DATE NOT NULL,
      expected_amount NUMERIC(12, 2) NOT NULL,
      paid_amount NUMERIC(12, 2) DEFAULT 0.00,
      status VARCHAR(20) DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      receipt_no VARCHAR(50) UNIQUE NOT NULL,
      loan_id INT REFERENCES loans(id) ON DELETE CASCADE,
      client_id INT,
      collector_id INT,
      amount_paid NUMERIC(12, 2) NOT NULL,
      previous_balance NUMERIC(12, 2) NOT NULL,
      remaining_balance NUMERIC(12, 2) NOT NULL,
      payment_type VARCHAR(20) DEFAULT 'FULL',
      payment_method VARCHAR(20) DEFAULT 'CASH',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INT,
      loan_id INT,
      client_id INT,
      type VARCHAR(50),
      message TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      dismissed BOOLEAN DEFAULT FALSE,
      due_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pgPool.query(schemaSql);
}

async function seedData() {
  const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

  if (usePostgres) {
    const userRes = await pgPool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userRes.rows[0].count, 10) === 0) {
      await pgPool.query(
        `INSERT INTO users (name, username, password_hash, role, phone)
         VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
        [
          'Business Owner', 'owner', hashPassword('owner123'), 'OWNER', '0771234567',
          'Kamal Perera (Agent)', 'agent1', hashPassword('agent123'), 'AGENT', '0779876543'
        ]
      );
    }
  } else {
    loadLocalStore();
    if (localStore.users.length === 0) {
      localStore.users = [
        {
          id: 1,
          name: 'Business Owner',
          username: 'owner',
          password_hash: hashPassword('owner123'),
          role: 'OWNER',
          phone: '0771234567',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Kamal Perera (Agent)',
          username: 'agent1',
          password_hash: hashPassword('agent123'),
          role: 'AGENT',
          phone: '0779876543',
          created_at: new Date().toISOString()
        }
      ];

      // Sample client
      localStore.clients = [
        {
          id: 1,
          name: 'Sunil Wickramasinghe',
          phone: '0714567890',
          nic_id: '198421004521',
          address: 'No 45, Galle Road, Colombo 03',
          notes: 'Vegetable stall vendor at main market',
          created_by: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Nimal Jayawardena',
          phone: '0758899112',
          nic_id: '199052103412',
          address: 'No 12, Station Road, Maharagama',
          notes: 'Grocery shop owner',
          created_by: 1,
          created_at: new Date().toISOString()
        }
      ];

      // Sample 58-installment loan
      const principal = 50000;
      const interestRate = 8;
      const totalInterest = (principal * interestRate) / 100; // 4000
      const totalPayable = principal + totalInterest; // 54000
      const installmentCount = 58;
      const installmentAmount = Math.round((totalPayable / installmentCount) * 100) / 100; // ~931.03

      const today = new Date();
      const startDateStr = today.toISOString().split('T')[0];

      const sampleLoan = {
        id: 1,
        loan_code: 'LN-2026-001',
        client_id: 1,
        created_by: 1,
        assigned_agent_id: 2,
        principal_amount: principal,
        interest_rate_pct: interestRate,
        total_interest: totalInterest,
        total_payable: totalPayable,
        installment_count: installmentCount,
        frequency: 'DAILY',
        installment_amount: installmentAmount,
        start_date: startDateStr,
        end_date: new Date(today.getTime() + 58 * 86400000).toISOString().split('T')[0],
        total_paid: installmentAmount * 2,
        remaining_balance: totalPayable - (installmentAmount * 2),
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };
      localStore.loans = [sampleLoan];

      // Generate 58 installments for this sample loan
      localStore.installments = [];
      let rem = totalPayable;
      for (let i = 1; i <= 58; i++) {
        const instDate = new Date(today.getTime() + (i - 1) * 86400000);
        let status = 'PENDING';
        let paid = 0;
        if (i <= 2) {
          status = 'PAID';
          paid = installmentAmount;
        }

        localStore.installments.push({
          id: i,
          loan_id: 1,
          installment_no: i,
          due_date: instDate.toISOString().split('T')[0],
          expected_amount: installmentAmount,
          paid_amount: paid,
          status: status
        });
      }

      // Sample initial payments and receipts
      localStore.payments = [
        {
          id: 1,
          receipt_no: 'REC-00001',
          loan_id: 1,
          client_id: 1,
          collector_id: 2,
          amount_paid: installmentAmount,
          previous_balance: totalPayable,
          remaining_balance: totalPayable - installmentAmount,
          payment_type: 'FULL',
          payment_method: 'CASH',
          notes: 'Installment #1 paid in full',
          created_at: new Date(today.getTime() - 86400000).toISOString()
        },
        {
          id: 2,
          receipt_no: 'REC-00002',
          loan_id: 1,
          client_id: 1,
          collector_id: 2,
          amount_paid: installmentAmount,
          previous_balance: totalPayable - installmentAmount,
          remaining_balance: totalPayable - (installmentAmount * 2),
          payment_type: 'FULL',
          payment_method: 'CASH',
          notes: 'Installment #2 paid in full',
          created_at: new Date().toISOString()
        }
      ];

      saveLocalStore();
    }
  }
}

async function initDb() {
  if (pgPool) {
    try {
      await pgPool.query('SELECT NOW()');
      console.log('Connected to PostgreSQL database successfully.');
      usePostgres = true;
      await initPostgresSchema();
      await seedData();
      return;
    } catch (err) {
      console.warn('PostgreSQL connection failed, falling back to local file storage:', err.message);
      usePostgres = false;
    }
  }
  console.log('Using local JSON database storage (data/db.json). Ready for cloud PostgreSQL anytime.');
  loadLocalStore();
  await seedData();
}

// Database query and helper methods
const db = {
  isPostgres: () => usePostgres,

  // USERS
  findUserByUsername: async (username) => {
    if (usePostgres) {
      const res = await pgPool.query('SELECT * FROM users WHERE username = $1', [username]);
      return res.rows[0];
    }
    loadLocalStore();
    return localStore.users.find(u => u.username === username);
  },

  findUserById: async (id) => {
    if (usePostgres) {
      const res = await pgPool.query('SELECT id, name, username, role, phone, created_at FROM users WHERE id = $1', [id]);
      return res.rows[0];
    }
    loadLocalStore();
    const u = localStore.users.find(u => u.id === parseInt(id, 10));
    if (!u) return null;
    const { password_hash, ...rest } = u;
    return rest;
  },

  getAllUsers: async () => {
    if (usePostgres) {
      const res = await pgPool.query('SELECT id, name, username, role, phone, created_at FROM users ORDER BY id ASC');
      return res.rows;
    }
    loadLocalStore();
    return localStore.users.map(({ password_hash, ...u }) => u);
  },

  createUser: async ({ name, username, password, role, phone }) => {
    const hash = bcrypt.hashSync(password, 10);
    if (usePostgres) {
      const res = await pgPool.query(
        'INSERT INTO users (name, username, password_hash, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, username, role, phone, created_at',
        [name, username, hash, role, phone]
      );
      return res.rows[0];
    }
    loadLocalStore();
    const newUser = {
      id: localStore.users.length ? Math.max(...localStore.users.map(u => u.id)) + 1 : 1,
      name,
      username,
      password_hash: hash,
      role,
      phone,
      created_at: new Date().toISOString()
    };
    localStore.users.push(newUser);
    saveLocalStore();
    const { password_hash, ...rest } = newUser;
    return rest;
  },

  // CLIENTS
  getAllClients: async () => {
    if (usePostgres) {
      const res = await pgPool.query(`
        SELECT c.*, 
          COALESCE(COUNT(l.id), 0) AS total_loans,
          COALESCE(SUM(CASE WHEN l.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_loans,
          COALESCE(SUM(CASE WHEN l.status = 'ACTIVE' THEN l.remaining_balance ELSE 0 END), 0) AS total_outstanding
        FROM clients c
        LEFT JOIN loans l ON c.id = l.client_id
        GROUP BY c.id
        ORDER BY c.id DESC
      `);
      return res.rows;
    }
    loadLocalStore();
    return localStore.clients.map(c => {
      const clientLoans = localStore.loans.filter(l => l.client_id === c.id);
      const activeLoans = clientLoans.filter(l => l.status === 'ACTIVE');
      const totalOutstanding = activeLoans.reduce((acc, l) => acc + (parseFloat(l.remaining_balance) || 0), 0);
      return {
        ...c,
        total_loans: clientLoans.length,
        active_loans: activeLoans.length,
        total_outstanding: totalOutstanding
      };
    }).sort((a, b) => b.id - a.id);
  },

  getClientById: async (id) => {
    if (usePostgres) {
      const res = await pgPool.query('SELECT * FROM clients WHERE id = $1', [id]);
      return res.rows[0];
    }
    loadLocalStore();
    return localStore.clients.find(c => c.id === parseInt(id, 10));
  },

  createClient: async ({ name, phone, nic_id, address, notes, created_by }) => {
    if (usePostgres) {
      const res = await pgPool.query(
        'INSERT INTO clients (name, phone, nic_id, address, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, phone, nic_id, address, notes, created_by]
      );
      return res.rows[0];
    }
    loadLocalStore();
    const newClient = {
      id: localStore.clients.length ? Math.max(...localStore.clients.map(c => c.id)) + 1 : 1,
      name,
      phone,
      nic_id,
      address,
      notes,
      created_by,
      created_at: new Date().toISOString()
    };
    localStore.clients.push(newClient);
    saveLocalStore();
    return newClient;
  },

  // LOANS & 58-INSTALLMENT ENGINE
  getAllLoans: async (filters = {}) => {
    if (usePostgres) {
      let query = `
        SELECT l.*, c.name AS client_name, c.phone AS client_phone, c.nic_id,
               u.name AS collector_name
        FROM loans l
        JOIN clients c ON l.client_id = c.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
      `;
      const conditions = [];
      const params = [];
      if (filters.status) {
        params.push(filters.status);
        conditions.push(`l.status = $${params.length}`);
      }
      if (filters.agent_id) {
        params.push(filters.agent_id);
        conditions.push(`l.assigned_agent_id = $${params.length}`);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY l.id DESC';
      const res = await pgPool.query(query, params);
      return res.rows;
    }
    loadLocalStore();
    let loans = localStore.loans.map(l => {
      const client = localStore.clients.find(c => c.id === l.client_id) || {};
      const agent = localStore.users.find(u => u.id === l.assigned_agent_id) || {};
      return {
        ...l,
        client_name: client.name || 'Unknown',
        client_phone: client.phone || '',
        nic_id: client.nic_id || '',
        collector_name: agent.name || 'Unassigned'
      };
    });

    if (filters.status) {
      loans = loans.filter(l => l.status === filters.status);
    }
    if (filters.agent_id) {
      loans = loans.filter(l => l.assigned_agent_id === parseInt(filters.agent_id, 10));
    }
    return loans.sort((a, b) => b.id - a.id);
  },

  getLoanById: async (id) => {
    if (usePostgres) {
      const loanRes = await pgPool.query(`
        SELECT l.*, c.name AS client_name, c.phone AS client_phone, c.nic_id, c.address AS client_address,
               u.name AS collector_name
        FROM loans l
        JOIN clients c ON l.client_id = c.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
        WHERE l.id = $1
      `, [id]);
      if (loanRes.rows.length === 0) return null;
      const loan = loanRes.rows[0];

      const instRes = await pgPool.query(
        'SELECT * FROM installments WHERE loan_id = $1 ORDER BY installment_no ASC',
        [id]
      );
      loan.installments = instRes.rows;

      const payRes = await pgPool.query(`
        SELECT p.*, u.name AS collector_name
        FROM payments p
        LEFT JOIN users u ON p.collector_id = u.id
        WHERE p.loan_id = $1
        ORDER BY p.id DESC
      `, [id]);
      loan.payments = payRes.rows;

      return loan;
    }

    loadLocalStore();
    const loan = localStore.loans.find(l => l.id === parseInt(id, 10));
    if (!loan) return null;

    const client = localStore.clients.find(c => c.id === loan.client_id) || {};
    const agent = localStore.users.find(u => u.id === loan.assigned_agent_id) || {};
    const installments = localStore.installments
      .filter(i => i.loan_id === loan.id)
      .sort((a, b) => a.installment_no - b.installment_no);
    const payments = localStore.payments
      .filter(p => p.loan_id === loan.id)
      .map(p => {
        const col = localStore.users.find(u => u.id === p.collector_id) || {};
        return { ...p, collector_name: col.name || 'Staff' };
      })
      .sort((a, b) => b.id - a.id);

    return {
      ...loan,
      client_name: client.name,
      client_phone: client.phone,
      nic_id: client.nic_id,
      client_address: client.address,
      collector_name: agent.name,
      installments,
      payments
    };
  },

  createLoan: async ({
    client_id,
    created_by,
    assigned_agent_id,
    principal_amount,
    interest_rate_pct = 8.00,
    installment_count = 58,
    frequency = 'DAILY',
    start_date
  }) => {
    const principal = parseFloat(principal_amount);
    const rate = parseFloat(interest_rate_pct);
    const totalInterest = Math.round(((principal * rate) / 100) * 100) / 100;
    const totalPayable = Math.round((principal + totalInterest) * 100) / 100;
    const count = parseInt(installment_count, 10) || 58;
    const installmentAmount = Math.round((totalPayable / count) * 100) / 100;

    const start = new Date(start_date || new Date().toISOString().split('T')[0]);

    // Calculate end date based on frequency
    let stepDays = 1;
    if (frequency === 'WEEKLY') stepDays = 7;
    if (frequency === 'MONTHLY') stepDays = 30;
    const endDate = new Date(start.getTime() + count * stepDays * 86400000);
    const endDateStr = endDate.toISOString().split('T')[0];

    const timestamp = Date.now().toString().slice(-4);
    const loanCode = `LN-${new Date().getFullYear()}-${timestamp}`;

    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query(
          `INSERT INTO loans (
            loan_code, client_id, created_by, assigned_agent_id,
            principal_amount, interest_rate_pct, total_interest, total_payable,
            installment_count, frequency, installment_amount,
            start_date, end_date, remaining_balance, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVE')
          RETURNING *`,
          [
            loanCode, client_id, created_by, assigned_agent_id,
            principal, rate, totalInterest, totalPayable,
            count, frequency, installmentAmount,
            start.toISOString().split('T')[0], endDateStr, totalPayable
          ]
        );
        const newLoan = loanRes.rows[0];

        // Insert 58 installments
        for (let i = 1; i <= count; i++) {
          const instDate = new Date(start.getTime() + (i - 1) * stepDays * 86400000);
          await client.query(
            `INSERT INTO installments (loan_id, installment_no, due_date, expected_amount, paid_amount, status)
             VALUES ($1, $2, $3, $4, 0.00, 'PENDING')`,
            [newLoan.id, i, instDate.toISOString().split('T')[0], installmentAmount]
          );
        }

        await client.query('COMMIT');
        return newLoan;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    loadLocalStore();
    const newId = localStore.loans.length ? Math.max(...localStore.loans.map(l => l.id)) + 1 : 1;
    const newLoan = {
      id: newId,
      loan_code: loanCode,
      client_id: parseInt(client_id, 10),
      created_by: parseInt(created_by, 10),
      assigned_agent_id: assigned_agent_id ? parseInt(assigned_agent_id, 10) : null,
      principal_amount: principal,
      interest_rate_pct: rate,
      total_interest: totalInterest,
      total_payable: totalPayable,
      installment_count: count,
      frequency,
      installment_amount: installmentAmount,
      start_date: start.toISOString().split('T')[0],
      end_date: endDateStr,
      total_paid: 0.00,
      remaining_balance: totalPayable,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    localStore.loans.push(newLoan);

    // Generate installments
    for (let i = 1; i <= count; i++) {
      const instId = localStore.installments.length ? Math.max(...localStore.installments.map(inst => inst.id)) + 1 : 1;
      const instDate = new Date(start.getTime() + (i - 1) * stepDays * 86400000);
      localStore.installments.push({
        id: instId,
        loan_id: newId,
        installment_no: i,
        due_date: instDate.toISOString().split('T')[0],
        expected_amount: installmentAmount,
        paid_amount: 0.00,
        status: 'PENDING'
      });
    }

    saveLocalStore();
    return newLoan;
  },

  // PAYMENTS & RECEIPT ENGINE (Full & Partial Payments)
  recordPayment: async ({
    loan_id,
    collector_id,
    amount_paid,
    payment_method = 'CASH',
    notes = ''
  }) => {
    const payAmount = Math.round(parseFloat(amount_paid) * 100) / 100;
    if (payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loan_id]);
        if (loanRes.rows.length === 0) throw new Error('Loan not found');
        const loan = loanRes.rows[0];

        const prevBalance = parseFloat(loan.remaining_balance);
        const newBalance = Math.max(0, Math.round((prevBalance - payAmount) * 100) / 100);
        const newTotalPaid = Math.round((parseFloat(loan.total_paid) + payAmount) * 100) / 100;
        const newStatus = newBalance <= 0 ? 'COMPLETED' : 'ACTIVE';

        // Update loan
        await client.query(
          'UPDATE loans SET remaining_balance = $1, total_paid = $2, status = $3 WHERE id = $4',
          [newBalance, newTotalPaid, newStatus, loan_id]
        );

        // Fetch unpaid or partially paid installments to allocate payment
        const instRes = await client.query(
          `SELECT * FROM installments 
           WHERE loan_id = $1 AND status != 'PAID' 
           ORDER BY installment_no ASC`,
          [loan_id]
        );

        let unallocated = payAmount;
        let affectedInstallmentNo = null;
        for (const inst of instRes.rows) {
          if (unallocated <= 0) break;
          const needed = Math.round((parseFloat(inst.expected_amount) - parseFloat(inst.paid_amount)) * 100) / 100;
          if (affectedInstallmentNo === null) {
            affectedInstallmentNo = inst.installment_no;
          }

          if (unallocated >= needed) {
            await client.query(
              `UPDATE installments SET paid_amount = expected_amount, status = 'PAID' WHERE id = $1`,
              [inst.id]
            );
            unallocated = Math.round((unallocated - needed) * 100) / 100;
          } else {
            const newPaid = Math.round((parseFloat(inst.paid_amount) + unallocated) * 100) / 100;
            await client.query(
              `UPDATE installments SET paid_amount = $1, status = 'PARTIAL' WHERE id = $2`,
              [newPaid, inst.id]
            );
            unallocated = 0;
          }
        }

        // Generate receipt number
        const countRes = await client.query('SELECT COUNT(*) FROM payments');
        const receiptSeq = parseInt(countRes.rows[0].count, 10) + 1;
        const receiptNo = `REC-${String(receiptSeq).padStart(5, '0')}`;

        const isPartial = payAmount < parseFloat(loan.installment_amount);
        const payRes = await client.query(
          `INSERT INTO payments (
            receipt_no, loan_id, client_id, collector_id,
            amount_paid, previous_balance, remaining_balance,
            payment_type, payment_method, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            receiptNo, loan_id, loan.client_id, collector_id,
            payAmount, prevBalance, newBalance,
            isPartial ? 'PARTIAL' : 'FULL', payment_method, notes
          ]
        );
        const payment = payRes.rows[0];

        // Fetch client and collector details for receipt
        const clientInfo = (await client.query('SELECT * FROM clients WHERE id = $1', [loan.client_id])).rows[0];
        const collectorInfo = (await client.query('SELECT name FROM users WHERE id = $1', [collector_id])).rows[0];

        // Find next due installment
        const nextInstRes = await client.query(
          `SELECT installment_no, due_date, expected_amount, paid_amount 
           FROM installments 
           WHERE loan_id = $1 AND status != 'PAID' 
           ORDER BY installment_no ASC LIMIT 1`,
          [loan_id]
        );

        await client.query('COMMIT');

        return {
          ...payment,
          loan_code: loan.loan_code,
          installment_count: loan.installment_count,
          current_installment_no: affectedInstallmentNo || 1,
          client_name: clientInfo.name,
          client_phone: clientInfo.phone,
          collector_name: collectorInfo ? collectorInfo.name : 'Collector',
          next_due_date: nextInstRes.rows.length ? nextInstRes.rows[0].due_date : 'Completed',
          next_due_amount: nextInstRes.rows.length ? (parseFloat(nextInstRes.rows[0].expected_amount) - parseFloat(nextInstRes.rows[0].paid_amount)) : 0
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    loadLocalStore();
    const loan = localStore.loans.find(l => l.id === parseInt(loan_id, 10));
    if (!loan) throw new Error('Loan not found');

    const prevBalance = parseFloat(loan.remaining_balance);
    const newBalance = Math.max(0, Math.round((prevBalance - payAmount) * 100) / 100);
    const newTotalPaid = Math.round((parseFloat(loan.total_paid) + payAmount) * 100) / 100;
    const newStatus = newBalance <= 0 ? 'COMPLETED' : 'ACTIVE';

    loan.remaining_balance = newBalance;
    loan.total_paid = newTotalPaid;
    loan.status = newStatus;

    // Allocate payment across installments
    const pendingInsts = localStore.installments
      .filter(i => i.loan_id === loan.id && i.status !== 'PAID')
      .sort((a, b) => a.installment_no - b.installment_no);

    let unallocated = payAmount;
    let affectedInstallmentNo = null;
    for (const inst of pendingInsts) {
      if (unallocated <= 0) break;
      const needed = Math.round((parseFloat(inst.expected_amount) - parseFloat(inst.paid_amount)) * 100) / 100;
      if (affectedInstallmentNo === null) {
        affectedInstallmentNo = inst.installment_no;
      }

      if (unallocated >= needed) {
        inst.paid_amount = inst.expected_amount;
        inst.status = 'PAID';
        unallocated = Math.round((unallocated - needed) * 100) / 100;
      } else {
        inst.paid_amount = Math.round((parseFloat(inst.paid_amount) + unallocated) * 100) / 100;
        inst.status = 'PARTIAL';
        unallocated = 0;
      }
    }

    const payId = localStore.payments.length ? Math.max(...localStore.payments.map(p => p.id)) + 1 : 1;
    const receiptNo = `REC-${String(payId).padStart(5, '0')}`;
    const isPartial = payAmount < parseFloat(loan.installment_amount);

    const newPayment = {
      id: payId,
      receipt_no: receiptNo,
      loan_id: loan.id,
      client_id: loan.client_id,
      collector_id: parseInt(collector_id, 10),
      amount_paid: payAmount,
      previous_balance: prevBalance,
      remaining_balance: newBalance,
      payment_type: isPartial ? 'PARTIAL' : 'FULL',
      payment_method,
      notes,
      created_at: new Date().toISOString()
    };
    localStore.payments.push(newPayment);
    saveLocalStore();

    const clientInfo = localStore.clients.find(c => c.id === loan.client_id) || {};
    const collectorInfo = localStore.users.find(u => u.id === parseInt(collector_id, 10)) || {};
    const nextInst = localStore.installments
      .filter(i => i.loan_id === loan.id && i.status !== 'PAID')
      .sort((a, b) => a.installment_no - b.installment_no)[0];

    return {
      ...newPayment,
      loan_code: loan.loan_code,
      installment_count: loan.installment_count,
      current_installment_no: affectedInstallmentNo || 1,
      client_name: clientInfo.name || 'Client',
      client_phone: clientInfo.phone || '',
      collector_name: collectorInfo.name || 'Collector',
      next_due_date: nextInst ? nextInst.due_date : 'Completed',
      next_due_amount: nextInst ? (parseFloat(nextInst.expected_amount) - parseFloat(nextInst.paid_amount)) : 0
    };
  },

  // LEAN NOTIFICATION & REMINDER CALCULATOR (No cloud storage waste)
  getReminders: async (userId, role) => {
    loadLocalStore();
    const todayStr = new Date().toISOString().split('T')[0];

    let loans = [];
    if (usePostgres) {
      let query = `
        SELECT l.id AS loan_id, l.loan_code, l.installment_amount, l.remaining_balance,
               c.name AS client_name, c.phone AS client_phone,
               i.id AS installment_id, i.installment_no, i.due_date, i.expected_amount, i.paid_amount, i.status AS inst_status
        FROM installments i
        JOIN loans l ON i.loan_id = l.id
        JOIN clients c ON l.client_id = c.id
        WHERE l.status = 'ACTIVE' AND i.status != 'PAID'
      `;
      if (role === 'AGENT') {
        query += ` AND l.assigned_agent_id = ${parseInt(userId, 10)}`;
      }
      const res = await pgPool.query(query);
      loans = res.rows;
    } else {
      const activeLoans = localStore.loans.filter(l => {
        if (l.status !== 'ACTIVE') return false;
        if (role === 'AGENT') return l.assigned_agent_id === parseInt(userId, 10);
        return true;
      });

      loans = [];
      for (const loan of activeLoans) {
        const client = localStore.clients.find(c => c.id === loan.client_id) || {};
        const pendingInsts = localStore.installments.filter(i => i.loan_id === loan.id && i.status !== 'PAID');
        for (const inst of pendingInsts) {
          loans.push({
            loan_id: loan.id,
            loan_code: loan.loan_code,
            installment_amount: loan.installment_amount,
            remaining_balance: loan.remaining_balance,
            client_name: client.name,
            client_phone: client.phone,
            installment_id: inst.id,
            installment_no: inst.installment_no,
            due_date: inst.due_date,
            expected_amount: inst.expected_amount,
            paid_amount: inst.paid_amount,
            inst_status: inst.status
          });
        }
      }
    }

    const dueToday = [];
    const overdue = [];

    for (const item of loans) {
      const balanceDue = Math.round((parseFloat(item.expected_amount) - parseFloat(item.paid_amount)) * 100) / 100;
      if (item.due_date === todayStr) {
        dueToday.push({
          ...item,
          balance_due: balanceDue,
          urgency: 'HIGH',
          title: `Due Today: Inst #${item.installment_no} of 58`,
          message: `${item.client_name} has Rs. ${balanceDue} due today for ${item.loan_code}.`
        });
      } else if (item.due_date < todayStr) {
        const daysLate = Math.floor((new Date(todayStr) - new Date(item.due_date)) / 86400000);
        overdue.push({
          ...item,
          balance_due: balanceDue,
          days_late: daysLate,
          urgency: 'CRITICAL',
          title: `Overdue (${daysLate} days late): Inst #${item.installment_no}`,
          message: `${item.client_name} is ${daysLate} days late. Amount due: Rs. ${balanceDue}.`
        });
      }
    }

    return {
      due_today_count: dueToday.length,
      overdue_count: overdue.length,
      due_today: dueToday,
      overdue: overdue
    };
  },

  // FINANCIAL DASHBOARD SUMMARY
  getDashboardMetrics: async () => {
    loadLocalStore();
    const todayStr = new Date().toISOString().split('T')[0];

    if (usePostgres) {
      const metrics = await pgPool.query(`
        SELECT 
          COALESCE(SUM(principal_amount), 0) AS total_capital_lent,
          COALESCE(SUM(total_interest), 0) AS total_expected_interest,
          COALESCE(SUM(total_payable), 0) AS total_receivable,
          COALESCE(SUM(total_paid), 0) AS total_collected,
          COALESCE(SUM(remaining_balance), 0) AS total_outstanding,
          COUNT(*) AS total_loans_count,
          COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_loans_count
        FROM loans
      `);

      const todayCollection = await pgPool.query(`
        SELECT COALESCE(SUM(amount_paid), 0) AS today_collected_amount, COUNT(*) AS today_payments_count
        FROM payments
        WHERE DATE(created_at) = CURRENT_DATE
      `);

      return {
        ...metrics.rows[0],
        ...todayCollection.rows[0]
      };
    }

    const totalCapitalLent = localStore.loans.reduce((acc, l) => acc + parseFloat(l.principal_amount), 0);
    const totalExpectedInterest = localStore.loans.reduce((acc, l) => acc + parseFloat(l.total_interest), 0);
    const totalReceivable = localStore.loans.reduce((acc, l) => acc + parseFloat(l.total_payable), 0);
    const totalCollected = localStore.loans.reduce((acc, l) => acc + parseFloat(l.total_paid), 0);
    const totalOutstanding = localStore.loans.reduce((acc, l) => acc + parseFloat(l.remaining_balance), 0);

    const todayPayments = localStore.payments.filter(p => p.created_at.startsWith(todayStr));
    const todayCollected = todayPayments.reduce((acc, p) => acc + parseFloat(p.amount_paid), 0);

    return {
      total_capital_lent: Math.round(totalCapitalLent * 100) / 100,
      total_expected_interest: Math.round(totalExpectedInterest * 100) / 100,
      total_receivable: Math.round(totalReceivable * 100) / 100,
      total_collected: Math.round(totalCollected * 100) / 100,
      total_outstanding: Math.round(totalOutstanding * 100) / 100,
      total_loans_count: localStore.loans.length,
      active_loans_count: localStore.loans.filter(l => l.status === 'ACTIVE').length,
      today_collected_amount: Math.round(todayCollected * 100) / 100,
      today_payments_count: todayPayments.length
    };
  }
};

module.exports = { initDb, db };
