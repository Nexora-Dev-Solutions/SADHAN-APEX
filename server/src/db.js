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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INT,
      username VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_nic ON clients (UPPER(TRIM(nic_id))) WHERE nic_id IS NOT NULL AND TRIM(nic_id) != '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_phone ON clients (TRIM(phone)) WHERE phone IS NOT NULL AND TRIM(phone) != '';

    ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_type VARCHAR(100);
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'VERIFIED';
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS kyc_notes TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url TEXT;

    ALTER TABLE loans ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_applied BOOLEAN DEFAULT FALSE;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_count INT DEFAULT 0;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_penalties NUMERIC(12, 2) DEFAULT 0.00;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS installment_no INT;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT '["COLLECT_PAYMENTS","ISSUE_LOANS","REGISTER_CLIENTS","VIEW_REPORTS"]';
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
      const res = await pgPool.query('SELECT id, name, username, password_hash, role, phone, COALESCE(status, \'ACTIVE\') AS status, COALESCE(permissions, \'["COLLECT_PAYMENTS","ISSUE_LOANS","REGISTER_CLIENTS","VIEW_REPORTS"]\') AS permissions, created_at FROM users WHERE username = $1', [username]);
      return res.rows[0];
    }
    loadLocalStore();
    return localStore.users.find(u => u.username === username);
  },

  findUserById: async (id) => {
    if (usePostgres) {
      const res = await pgPool.query('SELECT id, name, username, role, phone, COALESCE(status, \'ACTIVE\') AS status, COALESCE(permissions, \'["COLLECT_PAYMENTS","ISSUE_LOANS","REGISTER_CLIENTS","VIEW_REPORTS"]\') AS permissions, created_at FROM users WHERE id = $1', [id]);
      const row = res.rows[0];
      if (!row) return null;
      return {
        ...row,
        permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions || '[]') : (row.permissions || [])
      };
    }
    loadLocalStore();
    const u = localStore.users.find(u => u.id === parseInt(id, 10));
    if (!u) return null;
    const { password_hash, ...rest } = u;
    return {
      ...rest,
      status: rest.status || 'ACTIVE',
      permissions: Array.isArray(rest.permissions) ? rest.permissions : (typeof rest.permissions === 'string' ? JSON.parse(rest.permissions || '[]') : ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS'])
    };
  },

  getAllUsers: async () => {
    if (usePostgres) {
      const res = await pgPool.query(`
        SELECT u.id, u.name, u.username, u.role, u.phone, 
               COALESCE(u.status, 'ACTIVE') AS status,
               COALESCE(u.permissions, '["COLLECT_PAYMENTS","ISSUE_LOANS","REGISTER_CLIENTS","VIEW_REPORTS"]') AS permissions,
               u.created_at,
               COALESCE(COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ACTIVE'), 0) AS active_loans_count,
               COALESCE(SUM(p.amount_paid), 0) AS total_collected
        FROM users u
        LEFT JOIN loans l ON l.assigned_agent_id = u.id
        LEFT JOIN payments p ON p.collector_id = u.id
        GROUP BY u.id
        ORDER BY u.id ASC
      `);
      return res.rows.map(u => ({
        ...u,
        permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions || '[]') : (u.permissions || [])
      }));
    }
    loadLocalStore();
    return localStore.users.map(({ password_hash, ...u }) => {
      const activeLoans = (localStore.loans || []).filter(l => l.assigned_agent_id === u.id && l.status === 'ACTIVE');
      const totalCollected = (localStore.payments || []).filter(p => p.collector_id === u.id).reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0);
      let perms = [];
      if (Array.isArray(u.permissions)) perms = u.permissions;
      else if (typeof u.permissions === 'string') {
        try { perms = JSON.parse(u.permissions); } catch(e) { perms = []; }
      } else {
        perms = u.role === 'OWNER' 
          ? ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS', 'TOPUP_LOANS', 'MANAGE_USERS']
          : ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS'];
      }
      return {
        ...u,
        status: u.status || 'ACTIVE',
        permissions: perms,
        active_loans_count: activeLoans.length,
        total_collected: totalCollected
      };
    });
  },

  createUser: async ({ name, username, password, role, phone, permissions, status }) => {
    const hash = bcrypt.hashSync(password, 10);
    const userRole = (role || 'AGENT').toUpperCase();
    const userStatus = status || 'ACTIVE';
    const permsArray = Array.isArray(permissions) ? permissions : (
      userRole === 'OWNER' 
        ? ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS', 'TOPUP_LOANS', 'MANAGE_USERS']
        : ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS', 'VIEW_REPORTS']
    );
    const permsStr = JSON.stringify(permsArray);

    if (usePostgres) {
      const res = await pgPool.query(
        `INSERT INTO users (name, username, password_hash, role, phone, status, permissions) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, name, username, role, phone, status, permissions, created_at`,
        [name, username, hash, userRole, phone || '', userStatus, permsStr]
      );
      const row = res.rows[0];
      return {
        ...row,
        permissions: permsArray
      };
    }
    loadLocalStore();
    const newUser = {
      id: localStore.users.length ? Math.max(...localStore.users.map(u => u.id)) + 1 : 1,
      name,
      username,
      password_hash: hash,
      role: userRole,
      phone: phone || '',
      status: userStatus,
      permissions: permsArray,
      created_at: new Date().toISOString()
    };
    localStore.users.push(newUser);
    saveLocalStore();
    const { password_hash, ...rest } = newUser;
    return rest;
  },

  updateUser: async (id, { name, phone, role, status, permissions, password }) => {
    const userId = parseInt(id, 10);
    if (usePostgres) {
      const userRes = await pgPool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (!userRes.rows.length) throw new Error('User not found');
      const current = userRes.rows[0];

      const newName = name !== undefined ? name : current.name;
      const newPhone = phone !== undefined ? phone : current.phone;
      const newRole = role !== undefined ? role.toUpperCase() : current.role;
      const newStatus = status !== undefined ? status.toUpperCase() : (current.status || 'ACTIVE');
      let newPermsStr = current.permissions || '[]';
      if (permissions !== undefined) {
        newPermsStr = JSON.stringify(Array.isArray(permissions) ? permissions : []);
      }
      let newHash = current.password_hash;
      if (password && password.trim()) {
        newHash = bcrypt.hashSync(password.trim(), 10);
      }

      const updateRes = await pgPool.query(
        `UPDATE users 
         SET name = $1, phone = $2, role = $3, status = $4, permissions = $5, password_hash = $6 
         WHERE id = $7 
         RETURNING id, name, username, role, phone, status, permissions, created_at`,
        [newName, newPhone, newRole, newStatus, newPermsStr, newHash, userId]
      );
      const row = updateRes.rows[0];
      return {
        ...row,
        permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions || '[]') : row.permissions
      };
    }
    loadLocalStore();
    const idx = localStore.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    const u = localStore.users[idx];
    if (name !== undefined) u.name = name;
    if (phone !== undefined) u.phone = phone;
    if (role !== undefined) u.role = role.toUpperCase();
    if (status !== undefined) u.status = status.toUpperCase();
    if (permissions !== undefined) u.permissions = Array.isArray(permissions) ? permissions : [];
    if (password && password.trim()) {
      u.password_hash = bcrypt.hashSync(password.trim(), 10);
    }
    saveLocalStore();
    const { password_hash, ...rest } = u;
    return rest;
  },

  deleteUser: async (id, currentUserId) => {
    const userId = parseInt(id, 10);
    if (userId === parseInt(currentUserId, 10)) {
      throw new Error('You cannot delete your own account.');
    }
    if (usePostgres) {
      const loanCheck = await pgPool.query('SELECT COUNT(*) FROM loans WHERE assigned_agent_id = $1 AND status = \'ACTIVE\'', [userId]);
      if (parseInt(loanCheck.rows[0].count, 10) > 0) {
        throw new Error(`Cannot delete this agent because they currently have ${loanCheck.rows[0].count} active loans assigned. Please reassign their loans first.`);
      }
      await pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
      return { success: true };
    }
    loadLocalStore();
    const hasLoans = (localStore.loans || []).some(l => l.assigned_agent_id === userId && l.status === 'ACTIVE');
    if (hasLoans) {
      throw new Error('Cannot delete this agent because they currently have active loans assigned. Please reassign their loans first.');
    }
    localStore.users = localStore.users.filter(u => u.id !== userId);
    saveLocalStore();
    return { success: true };
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

  createClient: async ({
    name, phone, nic_id, address, notes,
    business_type, kyc_status, kyc_notes, photo_url,
    created_by
  }) => {
    // Normalize and validate phone
    let cleanPhone = phone ? phone.trim().replace(/[\s\-()]/g, '') : '';
    if (cleanPhone.startsWith('+94')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith('94') && cleanPhone.length === 11) {
      cleanPhone = '0' + cleanPhone.slice(2);
    }

    if (!cleanPhone || !/^0[0-9]{9}$/.test(cleanPhone)) {
      throw new Error(`Invalid Phone Number '${phone}'. Must be a 10-digit Sri Lankan phone number (e.g., 0771234567).`);
    }

    // Normalize and validate NIC (Required)
    const cleanNic = nic_id ? nic_id.trim().toUpperCase() : '';
    if (!cleanNic) {
      throw new Error('National Identity Card (NIC) is required.');
    }
    const oldNicPattern = /^[0-9]{9}[VX]$/;
    const newNicPattern = /^[0-9]{12}$/;
    if (!oldNicPattern.test(cleanNic) && !newNicPattern.test(cleanNic)) {
      throw new Error(`Invalid NIC format '${cleanNic}'. Sri Lankan NIC must be 9 digits with V/X (e.g. 842100452V) or 12 digits (e.g. 198421004521).`);
    }

    if (usePostgres) {
      // Check for duplicate NIC
      if (cleanNic) {
        const nicCheck = await pgPool.query(
          'SELECT id, name, phone, nic_id FROM clients WHERE UPPER(TRIM(nic_id)) = $1',
          [cleanNic]
        );
        if (nicCheck.rows.length > 0) {
          const dup = nicCheck.rows[0];
          throw new Error(`Duplicate NIC: Client with NIC '${cleanNic}' is already registered (${dup.name}, Phone: ${dup.phone}).`);
        }
      }

      // Check for duplicate phone
      if (cleanPhone) {
        const phoneCheck = await pgPool.query(
          'SELECT id, name, phone, nic_id FROM clients WHERE TRIM(phone) = $1',
          [cleanPhone]
        );
        if (phoneCheck.rows.length > 0) {
          const dup = phoneCheck.rows[0];
          throw new Error(`Duplicate Phone: Number '${cleanPhone}' is already registered to client ${dup.name}.`);
        }
      }

      try {
        const res = await pgPool.query(
          `INSERT INTO clients (
             name, phone, nic_id, address, notes,
             business_type, kyc_status, kyc_notes, photo_url,
             created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            name ? name.trim() : '',
            cleanPhone,
            cleanNic,
            address ? address.trim() : '',
            notes ? notes.trim() : '',
            business_type ? business_type.trim() : '',
            kyc_status || 'VERIFIED',
            kyc_notes ? kyc_notes.trim() : '',
            photo_url || '',
            created_by
          ]
        );
        return res.rows[0];
      } catch (insertErr) {
        if (insertErr.code === '23505') {
          if (insertErr.constraint === 'idx_clients_unique_nic' || (insertErr.detail && insertErr.detail.includes('nic_id'))) {
            throw new Error(`Duplicate NIC: Client with NIC '${cleanNic}' is already registered.`);
          }
          if (insertErr.constraint === 'idx_clients_unique_phone' || (insertErr.detail && insertErr.detail.includes('phone'))) {
            throw new Error(`Duplicate Phone: Number '${cleanPhone}' is already registered.`);
          }
        }
        throw insertErr;
      }
    }

    loadLocalStore();

    // Check duplicate NIC in local store
    if (cleanNic) {
      const dupNic = localStore.clients.find(c => c.nic_id && c.nic_id.trim().toUpperCase() === cleanNic);
      if (dupNic) {
        throw new Error(`Duplicate NIC: Client with NIC '${cleanNic}' is already registered (${dupNic.name}, Phone: ${dupNic.phone}).`);
      }
    }

    // Check duplicate phone in local store
    if (cleanPhone) {
      const dupPhone = localStore.clients.find(c => c.phone && c.phone.trim().replace(/[\s\-()]/g, '') === cleanPhone);
      if (dupPhone) {
        throw new Error(`Duplicate Phone: Number '${cleanPhone}' is already registered to client ${dupPhone.name}.`);
      }
    }

    const newClient = {
      id: localStore.clients.length ? Math.max(...localStore.clients.map(c => c.id)) + 1 : 1,
      name: name ? name.trim() : '',
      phone: cleanPhone,
      nic_id: cleanNic,
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : '',
      business_type: business_type ? business_type.trim() : '',
      kyc_status: kyc_status || 'VERIFIED',
      kyc_notes: kyc_notes ? kyc_notes.trim() : '',
      photo_url: photo_url || '',
      created_by,
      created_at: new Date().toISOString()
    };
    localStore.clients.push(newClient);
    saveLocalStore();
    return newClient;
  },

  updateClient: async (id, {
    name, phone, nic_id, address, notes,
    business_type, kyc_status, kyc_notes, photo_url
  }) => {
    const clientId = parseInt(id, 10);
    
    // Normalize and validate phone if provided
    let cleanPhone = undefined;
    if (phone !== undefined) {
      cleanPhone = phone.trim().replace(/[\s\-()]/g, '');
      if (cleanPhone.startsWith('+94')) {
        cleanPhone = '0' + cleanPhone.slice(3);
      } else if (cleanPhone.startsWith('94') && cleanPhone.length === 11) {
        cleanPhone = '0' + cleanPhone.slice(2);
      }
      if (!cleanPhone || !/^0[0-9]{9}$/.test(cleanPhone)) {
        throw new Error(`Invalid Phone Number '${phone}'. Must be a 10-digit Sri Lankan phone number (e.g., 0771234567).`);
      }
    }

    // Normalize and validate NIC if provided
    let cleanNic = undefined;
    if (nic_id !== undefined) {
      cleanNic = nic_id.trim().toUpperCase();
      if (!cleanNic) {
        throw new Error('National Identity Card (NIC) cannot be empty.');
      }
      const oldNicPattern = /^[0-9]{9}[VX]$/;
      const newNicPattern = /^[0-9]{12}$/;
      if (!oldNicPattern.test(cleanNic) && !newNicPattern.test(cleanNic)) {
        throw new Error(`Invalid NIC format '${cleanNic}'. Sri Lankan NIC must be 9 digits with V/X (e.g. 842100452V) or 12 digits (e.g. 198421004521).`);
      }
    }

    if (usePostgres) {
      // Check duplicate NIC for other clients
      if (cleanNic) {
        const nicCheck = await pgPool.query(
          'SELECT id, name, phone, nic_id FROM clients WHERE UPPER(TRIM(nic_id)) = $1 AND id != $2',
          [cleanNic, clientId]
        );
        if (nicCheck.rows.length > 0) {
          const dup = nicCheck.rows[0];
          throw new Error(`Duplicate NIC: NIC '${cleanNic}' is already registered to another client (${dup.name}, Phone: ${dup.phone}).`);
        }
      }

      // Check duplicate Phone for other clients
      if (cleanPhone) {
        const phoneCheck = await pgPool.query(
          'SELECT id, name, phone, nic_id FROM clients WHERE TRIM(phone) = $1 AND id != $2',
          [cleanPhone, clientId]
        );
        if (phoneCheck.rows.length > 0) {
          const dup = phoneCheck.rows[0];
          throw new Error(`Duplicate Phone: Number '${cleanPhone}' is already registered to another client (${dup.name}).`);
        }
      }

      try {
        const res = await pgPool.query(
          `UPDATE clients 
           SET name = COALESCE($1, name),
               phone = COALESCE($2, phone),
               nic_id = COALESCE($3, nic_id),
               address = COALESCE($4, address),
               notes = COALESCE($5, notes),
               business_type = COALESCE($6, business_type),
               kyc_status = COALESCE($7, kyc_status),
               kyc_notes = COALESCE($8, kyc_notes),
               photo_url = COALESCE($9, photo_url)
           WHERE id = $10 RETURNING *`,
          [
            name ? name.trim() : null,
            cleanPhone,
            cleanNic,
            address ? address.trim() : null,
            notes ? notes.trim() : null,
            business_type !== undefined ? (business_type ? business_type.trim() : '') : null,
            kyc_status !== undefined ? kyc_status : null,
            kyc_notes !== undefined ? (kyc_notes ? kyc_notes.trim() : '') : null,
            photo_url !== undefined ? photo_url : null,
            clientId
          ]
        );
        if (res.rows.length === 0) throw new Error('Client not found');
        return res.rows[0];
      } catch (updateErr) {
        if (updateErr.code === '23505') {
          if (updateErr.constraint === 'idx_clients_unique_nic' || (updateErr.detail && updateErr.detail.includes('nic_id'))) {
            throw new Error(`Duplicate NIC: Client with NIC '${cleanNic}' already exists in the system.`);
          }
          if (updateErr.constraint === 'idx_clients_unique_phone' || (updateErr.detail && updateErr.detail.includes('phone'))) {
            throw new Error(`Duplicate Phone: Number '${cleanPhone}' already exists in the system.`);
          }
        }
        throw updateErr;
      }
    }

    loadLocalStore();
    const c = localStore.clients.find(item => item.id === clientId);
    if (!c) throw new Error('Client not found');

    if (cleanNic) {
      const dupNic = localStore.clients.find(item => item.id !== clientId && item.nic_id && item.nic_id.trim().toUpperCase() === cleanNic);
      if (dupNic) {
        throw new Error(`Duplicate NIC: NIC '${cleanNic}' is already registered to another client (${dupNic.name}, Phone: ${dupNic.phone}).`);
      }
    }

    if (cleanPhone) {
      const dupPhone = localStore.clients.find(item => item.id !== clientId && item.phone && item.phone.trim().replace(/[\s\-()]/g, '') === cleanPhone);
      if (dupPhone) {
        throw new Error(`Duplicate Phone: Number '${cleanPhone}' is already registered to another client (${dupPhone.name}).`);
      }
    }

    if (name !== undefined) c.name = name.trim();
    if (cleanPhone !== undefined) c.phone = cleanPhone;
    if (cleanNic !== undefined) c.nic_id = cleanNic;
    if (address !== undefined) c.address = address.trim();
    if (notes !== undefined) c.notes = notes.trim();
    if (business_type !== undefined) c.business_type = business_type.trim();
    if (kyc_status !== undefined) c.kyc_status = kyc_status;
    if (kyc_notes !== undefined) c.kyc_notes = kyc_notes.trim();
    if (photo_url !== undefined) c.photo_url = photo_url;
    saveLocalStore();
    return c;
  },

  deleteClient: async (id) => {
    const clientId = parseInt(id, 10);
    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM payments WHERE client_id = $1', [clientId]);
        await client.query('DELETE FROM loans WHERE client_id = $1', [clientId]);
        const res = await client.query('DELETE FROM clients WHERE id = $1 RETURNING id', [clientId]);
        if (res.rows.length === 0) throw new Error('Client not found');
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    loadLocalStore();
    const exists = localStore.clients.some(c => c.id === clientId);
    if (!exists) throw new Error('Client not found');
    localStore.payments = localStore.payments.filter(p => p.client_id !== clientId);
    const clientLoans = localStore.loans.filter(l => l.client_id === clientId).map(l => l.id);
    localStore.installments = localStore.installments.filter(i => !clientLoans.includes(i.loan_id));
    localStore.loans = localStore.loans.filter(l => l.client_id !== clientId);
    localStore.clients = localStore.clients.filter(c => c.id !== clientId);
    saveLocalStore();
    return true;
  },


  // LOANS & 58-INSTALLMENT ENGINE
  getAllLoans: async (filters = {}) => {
    await db.autoApplyOverduePenalties();
    if (usePostgres) {
      let query = `
        SELECT l.*, c.name AS client_name, c.phone AS client_phone, c.nic_id, c.photo_url,
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
        photo_url: client.photo_url || '',
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
    await db.autoApplyOverduePenalties();
    if (usePostgres) {
      const loanRes = await pgPool.query(`
        SELECT l.*, c.name AS client_name, c.phone AS client_phone, c.nic_id, c.address AS client_address, c.photo_url,
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
      photo_url: client.photo_url || '',
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
    const rate = parseFloat(interest_rate_pct) || 8.00;
    const maxSlots = parseInt(installment_count, 10) || 58;
    const baseScheduleCount = 54; // Standard 54-day payback schedule before 58-day limit

    // 1. Calculate raw interest & standard daily installment based on 54 installments
    const rawTotalInterest = (principal * rate) / 100;
    const rawTotalPayable = principal + rawTotalInterest;
    const rawInstallment = (rawTotalPayable / baseScheduleCount);

    // 2. Round off installment cleanly:
    let installmentAmount = 0;
    if (rawInstallment >= 1000) {
      installmentAmount = Math.round(rawInstallment / 100) * 100;
    } else if (rawInstallment >= 300) {
      installmentAmount = Math.round(rawInstallment / 50) * 50;
    } else if (rawInstallment > 0) {
      installmentAmount = Math.round(rawInstallment / 10) * 10 || 10;
    }

    if (principal > 0 && rate > 0 && (installmentAmount * baseScheduleCount) <= principal) {
      if (rawInstallment >= 1000) {
        installmentAmount = Math.ceil(rawInstallment / 100) * 100;
      } else if (rawInstallment >= 300) {
        installmentAmount = Math.ceil(rawInstallment / 50) * 50;
      } else {
        installmentAmount = Math.ceil(rawInstallment / 10) * 10;
      }
    }

    // 3. Derive total payable directly from clean rounded installments (54 scheduled)
    const totalPayable = Math.round(installmentAmount * baseScheduleCount);
    const totalInterest = Math.max(0, Math.round(totalPayable - principal));

    let start = new Date(start_date || new Date().toISOString().split('T')[0]);
    if (isNaN(start.getTime())) {
      start = new Date();
    }

    // Calculate end date based on frequency (58 days max)
    let stepDays = 1;
    if (frequency === 'WEEKLY') stepDays = 7;
    if (frequency === 'MONTHLY') stepDays = 30;
    const endDate = new Date(start.getTime() + maxSlots * stepDays * 86400000);
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
            maxSlots, frequency, installmentAmount,
            start.toISOString().split('T')[0], endDateStr, totalPayable
          ]
        );
        const newLoan = loanRes.rows[0];

        // Insert 58 installment slots (Slots 1-54 scheduled, 55-58 buffer)
        for (let i = 1; i <= maxSlots; i++) {
          const instDate = new Date(start.getTime() + (i - 1) * stepDays * 86400000);
          const expAmt = (i <= baseScheduleCount) ? installmentAmount : 0.00;
          const initialStatus = (i <= baseScheduleCount) ? 'PENDING' : 'BLANK';
          await client.query(
            `INSERT INTO installments (loan_id, installment_no, due_date, expected_amount, paid_amount, status)
             VALUES ($1, $2, $3, $4, 0.00, $5)`,
            [newLoan.id, i, instDate.toISOString().split('T')[0], expAmt, initialStatus]
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
      installment_count: maxSlots,
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
    for (let i = 1; i <= maxSlots; i++) {
      const instId = localStore.installments.length ? Math.max(...localStore.installments.map(inst => inst.id)) + 1 : 1;
      const instDate = new Date(start.getTime() + (i - 1) * stepDays * 86400000);
      const expAmt = (i <= baseScheduleCount) ? installmentAmount : 0.00;
      const initialStatus = (i <= baseScheduleCount) ? 'PENDING' : 'BLANK';
      localStore.installments.push({
        id: instId,
        loan_id: newId,
        installment_no: i,
        due_date: instDate.toISOString().split('T')[0],
        expected_amount: expAmt,
        paid_amount: 0.00,
        status: initialStatus
      });
    }

    saveLocalStore();
    return newLoan;
  },

  updateLoan: async (id, {
    principal_amount,
    topup_amount,
    interest_rate_pct,
    assigned_agent_id,
    status
  }) => {
    const loanId = parseInt(id, 10);

    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
        if (loanRes.rows.length === 0) throw new Error('Loan not found');
        const loan = loanRes.rows[0];

        const oldPrincipal = parseFloat(loan.principal_amount);
        let newPrincipal = oldPrincipal;
        if (topup_amount && parseFloat(topup_amount) > 0) {
          newPrincipal = oldPrincipal + parseFloat(topup_amount);
        } else if (principal_amount && parseFloat(principal_amount) > 0) {
          newPrincipal = parseFloat(principal_amount);
        }

        const newRate = interest_rate_pct !== undefined ? parseFloat(interest_rate_pct) : parseFloat(loan.interest_rate_pct);
        const count = parseInt(loan.installment_count, 10) || 58;

        const rawNewInterest = (newPrincipal * newRate) / 100;
        const rawNewPayable = newPrincipal + rawNewInterest;
        const rawNewInst = count > 0 ? (rawNewPayable / count) : 0;

        let newInstAmount = 0;
        if (rawNewInst >= 1000) {
          newInstAmount = Math.round(rawNewInst / 100) * 100;
        } else if (rawNewInst >= 300) {
          newInstAmount = Math.round(rawNewInst / 50) * 50;
        } else if (rawNewInst > 0) {
          newInstAmount = Math.round(rawNewInst / 10) * 10 || 10;
        }

        if (count > 0 && newPrincipal > 0 && newRate > 0 && (newInstAmount * count) <= newPrincipal) {
          if (rawNewInst >= 1000) {
            newInstAmount = Math.ceil(rawNewInst / 100) * 100;
          } else if (rawNewInst >= 300) {
            newInstAmount = Math.ceil(rawNewInst / 50) * 50;
          } else {
            newInstAmount = Math.ceil(rawNewInst / 10) * 10;
          }
        }

        const newTotalPayable = Math.round(newInstAmount * count);
        const newTotalInterest = Math.max(0, Math.round(newTotalPayable - newPrincipal));
        const currentPaid = parseFloat(loan.total_paid);
        const newRemaining = Math.max(0, Math.round(newTotalPayable - currentPaid));
        const newAgent = assigned_agent_id !== undefined ? (assigned_agent_id ? parseInt(assigned_agent_id, 10) : null) : loan.assigned_agent_id;
        const newStatus = status || (newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE');

        const updatedRes = await client.query(
          `UPDATE loans 
           SET principal_amount = $1, interest_rate_pct = $2, total_interest = $3,
               total_payable = $4, installment_amount = $5, remaining_balance = $6,
               assigned_agent_id = $7, status = $8
           WHERE id = $9 RETURNING *`,
          [
            newPrincipal, newRate, newTotalInterest,
            newTotalPayable, newInstAmount, newRemaining,
            newAgent, newStatus, loanId
          ]
        );

        // Rebalance remaining unpaid installments
        const unpaidRes = await client.query(
          `SELECT * FROM installments WHERE loan_id = $1 AND status != 'PAID' ORDER BY installment_no ASC`,
          [loanId]
        );

        if (unpaidRes.rows.length > 0) {
          const unpaidCount = unpaidRes.rows.length;
          for (let i = 0; i < unpaidCount; i++) {
            const inst = unpaidRes.rows[i];
            await client.query(
              `UPDATE installments SET expected_amount = $1 WHERE id = $2`,
              [newInstAmount, inst.id]
            );
          }
        }

        // If loan is fully settled, blank out remaining unpaid slots
        if (newRemaining <= 0 || newStatus === 'COMPLETED') {
          await client.query(
            `UPDATE installments SET expected_amount = 0.00, status = 'BLANK' WHERE loan_id = $1 AND status != 'PAID'`,
            [loanId]
          );
        }

        await client.query('COMMIT');
        return updatedRes.rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    loadLocalStore();
    const loan = localStore.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Loan not found');

    const oldPrincipal = parseFloat(loan.principal_amount);
    let newPrincipal = oldPrincipal;
    if (topup_amount && parseFloat(topup_amount) > 0) {
      newPrincipal = oldPrincipal + parseFloat(topup_amount);
    } else if (principal_amount && parseFloat(principal_amount) > 0) {
      newPrincipal = parseFloat(principal_amount);
    }

    const newRate = interest_rate_pct !== undefined ? parseFloat(interest_rate_pct) : parseFloat(loan.interest_rate_pct);
    const count = parseInt(loan.installment_count, 10) || 58;

    const rawNewInterest = (newPrincipal * newRate) / 100;
    const rawNewPayable = newPrincipal + rawNewInterest;
    const rawNewInst = count > 0 ? (rawNewPayable / count) : 0;

    let newInstAmount = 0;
    if (rawNewInst >= 1000) {
      newInstAmount = Math.round(rawNewInst / 100) * 100;
    } else if (rawNewInst >= 300) {
      newInstAmount = Math.round(rawNewInst / 50) * 50;
    } else if (rawNewInst > 0) {
      newInstAmount = Math.round(rawNewInst / 10) * 10 || 10;
    }

    if (count > 0 && newPrincipal > 0 && newRate > 0 && (newInstAmount * count) <= newPrincipal) {
      if (rawNewInst >= 1000) {
        newInstAmount = Math.ceil(rawNewInst / 100) * 100;
      } else if (rawNewInst >= 300) {
        newInstAmount = Math.ceil(rawNewInst / 50) * 50;
      } else {
        newInstAmount = Math.ceil(rawNewInst / 10) * 10;
      }
    }

    const newTotalPayable = Math.round(newInstAmount * count);
    const newTotalInterest = Math.max(0, Math.round(newTotalPayable - newPrincipal));
    const currentPaid = parseFloat(loan.total_paid);
    const newRemaining = Math.max(0, Math.round(newTotalPayable - currentPaid));

    loan.principal_amount = newPrincipal;
    loan.interest_rate_pct = newRate;
    loan.total_interest = newTotalInterest;
    loan.total_payable = newTotalPayable;
    loan.installment_amount = newInstAmount;
    loan.remaining_balance = newRemaining;
    if (assigned_agent_id !== undefined) loan.assigned_agent_id = assigned_agent_id ? parseInt(assigned_agent_id, 10) : null;
    if (status) loan.status = status;
    else if (newRemaining <= 0) loan.status = 'COMPLETED';

    // Rebalance unpaid installments
    const unpaidInsts = localStore.installments
      .filter(i => i.loan_id === loanId && i.status !== 'PAID')
      .sort((a, b) => a.installment_no - b.installment_no);

    if (unpaidInsts.length > 0) {
      const unpaidCount = unpaidInsts.length;
      const adjustedExpected = Math.round((newRemaining / unpaidCount) * 100) / 100;
      for (let i = 0; i < unpaidCount; i++) {
        const inst = unpaidInsts[i];
        const isLast = (i === unpaidCount - 1);
        const exp = isLast 
          ? Math.round((newRemaining - (adjustedExpected * (unpaidCount - 1))) * 100) / 100
          : adjustedExpected;
        inst.expected_amount = Math.max(0, exp);
      }
    }

    // If loan is fully settled, blank out remaining unpaid slots
    if (newRemaining <= 0 || loan.status === 'COMPLETED') {
      localStore.installments
        .filter(i => i.loan_id === loanId && i.status !== 'PAID')
        .forEach(i => {
          i.expected_amount = 0.00;
          i.status = 'BLANK';
        });
    }

    saveLocalStore();
    return loan;
  },

  deleteLoan: async (id) => {
    const loanId = parseInt(id, 10);
    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM payments WHERE loan_id = $1', [loanId]);
        await client.query('DELETE FROM installments WHERE loan_id = $1', [loanId]);
        const res = await client.query('DELETE FROM loans WHERE id = $1 RETURNING id', [loanId]);
        if (res.rows.length === 0) throw new Error('Loan not found');
        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    loadLocalStore();
    const exists = localStore.loans.some(l => l.id === loanId);
    if (!exists) throw new Error('Loan not found');
    localStore.payments = localStore.payments.filter(p => p.loan_id !== loanId);
    localStore.installments = localStore.installments.filter(i => i.loan_id !== loanId);
    localStore.loans = localStore.loans.filter(l => l.id !== loanId);
    saveLocalStore();
    return true;
  },

  // AUTOMATICALLY APPLY 8% PENALTY TO ALL LOANS FOR EVERY 58 INSTALLMENTS EXCEEDED
  autoApplyOverduePenalties: async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    if (usePostgres) {
      try {
        const activeLoansRes = await pgPool.query(
          `SELECT id, start_date, frequency, remaining_balance, end_date, notes, penalty_count, total_penalties, created_at 
           FROM loans 
           WHERE status = 'ACTIVE' AND remaining_balance > 0`
        );

        for (const loan of activeLoansRes.rows) {
          try {
            const start = new Date(loan.start_date || loan.created_at);
            let stepDays = 1;
            if (loan.frequency === 'WEEKLY') stepDays = 7;
            if (loan.frequency === 'MONTHLY') stepDays = 30;

            let currentCount = parseInt(loan.penalty_count, 10) || 0;
            if (currentCount === 0 && loan.notes && loan.notes.includes('[Penalty')) {
              const m = loan.notes.match(/\[Penalty/g);
              currentCount = m ? m.length : 1;
            }

            let cycle = currentCount + 1;
            while (true) {
              const cycleDue = new Date(start.getTime() + (cycle * 58 - 1) * stepDays * 86400000);
              const cycleDueStr = cycleDue.toISOString().split('T')[0];

              if (todayStr > cycleDueStr) {
                console.log(`[Auto-Penalty] Auto-applying 8% penalty cycle #${cycle} on loan ID ${loan.id}`);
                const updated = await db.applyPenalty(loan.id, 8.0, cycle);
                if (!updated || parseFloat(updated.remaining_balance) <= 0) break;
                cycle++;
              } else {
                break;
              }
            }
          } catch (err) {
            console.error(`[Auto-Penalty Error] Loan ${loan.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[Auto-Penalty] Postgres query error:', err);
      }
      return;
    }

    // LocalStore fallback
    loadLocalStore();
    const activeLoans = (localStore.loans || []).filter(l => l.status === 'ACTIVE' && parseFloat(l.remaining_balance) > 0);

    for (const loan of activeLoans) {
      try {
        const start = new Date(loan.start_date || loan.created_at);
        let stepDays = 1;
        if (loan.frequency === 'WEEKLY') stepDays = 7;
        if (loan.frequency === 'MONTHLY') stepDays = 30;

        let currentCount = parseInt(loan.penalty_count, 10) || 0;
        if (currentCount === 0 && loan.notes && loan.notes.includes('[Penalty')) {
          const m = loan.notes.match(/\[Penalty/g);
          currentCount = m ? m.length : 1;
        }

        let cycle = currentCount + 1;
        while (true) {
          const cycleDue = new Date(start.getTime() + (cycle * 58 - 1) * stepDays * 86400000);
          const cycleDueStr = cycleDue.toISOString().split('T')[0];

          if (todayStr > cycleDueStr) {
            console.log(`[Auto-Penalty] Auto-applying 8% penalty cycle #${cycle} on loan ID ${loan.id}`);
            const updated = await db.applyPenalty(loan.id, 8.0, cycle);
            if (!updated || parseFloat(updated.remaining_balance) <= 0) break;
            cycle++;
          } else {
            break;
          }
        }
      } catch (err) {
        console.error(`[Auto-Penalty Error] Loan ${loan.id}:`, err);
      }
    }
  },

  // APPLY 8% OVERDUE PENALTY (Recurring every 58-installment cycle exceeded)
  applyPenalty: async (loanId, penaltyPct = 8.0, targetCycle = null) => {
    const id = parseInt(loanId, 10);
    const rate = parseFloat(penaltyPct) || 8.0;

    if (usePostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const loanRes = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', [id]);
        if (loanRes.rows.length === 0) throw new Error('Loan not found');
        const loan = loanRes.rows[0];

        const rem = parseFloat(loan.remaining_balance);
        if (rem <= 0 || loan.status === 'COMPLETED') {
          await client.query('COMMIT');
          return loan;
        }

        let currentPenaltyCount = parseInt(loan.penalty_count, 10) || 0;
        if (currentPenaltyCount === 0 && loan.notes && loan.notes.includes('[Penalty')) {
          const m = loan.notes.match(/\[Penalty/g);
          currentPenaltyCount = m ? m.length : 1;
        }

        const nextCycle = targetCycle !== null ? targetCycle : (currentPenaltyCount + 1);
        if (nextCycle <= currentPenaltyCount) {
          await client.query('COMMIT');
          return loan;
        }

        const penaltyAmount = Math.round(rem * (rate / 100));
        if (penaltyAmount <= 0) {
          await client.query('COMMIT');
          return loan;
        }

        const newRemaining = Math.round(rem + penaltyAmount);
        const newTotalPayable = Math.round(parseFloat(loan.total_payable) + penaltyAmount);
        const newTotalInterest = Math.round(parseFloat(loan.total_interest) + penaltyAmount);
        const newTotalPenalties = Math.round((parseFloat(loan.total_penalties) || 0) + penaltyAmount);

        let stepDays = 1;
        if (loan.frequency === 'WEEKLY') stepDays = 7;
        if (loan.frequency === 'MONTHLY') stepDays = 30;
        const start = new Date(loan.start_date || loan.created_at);

        // Every penalty cycle unlocks an extra set of 58 installments
        // Cycle 1: (1 + 1) * 58 = 116 slots
        // Cycle 2: (2 + 1) * 58 = 174 slots
        // Cycle 3: (3 + 1) * 58 = 232 slots
        const targetSlots = Math.max(parseInt(loan.installment_count, 10) || 58, (nextCycle + 1) * 58);
        const instAmt = parseFloat(loan.installment_amount) || 100;

        const instsRes = await client.query(
          'SELECT id, installment_no, status FROM installments WHERE loan_id = $1 ORDER BY installment_no ASC',
          [id]
        );
        const existingInsts = instsRes.rows;
        const maxExistingNo = existingInsts.length ? Math.max(...existingInsts.map(i => i.installment_no)) : 58;

        // Activate existing BLANK buffer slots
        await client.query(
          `UPDATE installments 
           SET expected_amount = $1, status = 'PENDING' 
           WHERE loan_id = $2 AND status = 'BLANK'`,
          [instAmt, id]
        );

        // Append new 58-installment set slots up to targetSlots
        for (let i = maxExistingNo + 1; i <= targetSlots; i++) {
          const instDate = new Date(start.getTime() + (i - 1) * stepDays * 86400000);
          await client.query(
            `INSERT INTO installments (loan_id, installment_no, due_date, expected_amount, paid_amount, status)
             VALUES ($1, $2, $3, $4, 0.00, 'PENDING')`,
            [id, i, instDate.toISOString().split('T')[0], instAmt]
          );
        }

        const newEndDateRes = await client.query(
          'SELECT due_date FROM installments WHERE loan_id = $1 ORDER BY installment_no DESC LIMIT 1',
          [id]
        );
        const newEndDate = newEndDateRes.rows[0].due_date;
        const penaltyNote = ` [Penalty Cycle #${nextCycle}: Rs. ${penaltyAmount} (${rate}% overdue penalty on remaining Rs. ${rem})]`;

        const updatedRes = await client.query(
          `UPDATE loans 
           SET remaining_balance = $1, total_payable = $2, total_interest = $3,
               installment_count = $4, end_date = $5,
               notes = COALESCE(notes, '') || $6,
               penalty_applied = TRUE,
               penalty_count = $7,
               total_penalties = $8
           WHERE id = $9 RETURNING *`,
          [
            newRemaining, newTotalPayable, newTotalInterest,
            targetSlots, newEndDate,
            penaltyNote,
            nextCycle,
            newTotalPenalties,
            id
          ]
        );

        await client.query('COMMIT');
        return updatedRes.rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // LocalStore fallback
    loadLocalStore();
    const loan = localStore.loans.find(l => l.id === id);
    if (!loan) throw new Error('Loan not found');

    const rem = parseFloat(loan.remaining_balance);
    if (rem <= 0 || loan.status === 'COMPLETED') {
      return loan;
    }

    let currentPenaltyCount = parseInt(loan.penalty_count, 10) || 0;
    if (currentPenaltyCount === 0 && loan.notes && loan.notes.includes('[Penalty')) {
      const m = loan.notes.match(/\[Penalty/g);
      currentPenaltyCount = m ? m.length : 1;
    }

    const nextCycle = targetCycle !== null ? targetCycle : (currentPenaltyCount + 1);
    if (nextCycle <= currentPenaltyCount) {
      return loan;
    }

    const penaltyAmount = Math.round(rem * (rate / 100));
    if (penaltyAmount <= 0) return loan;

    const newRemaining = Math.round(rem + penaltyAmount);
    loan.remaining_balance = newRemaining;
    loan.total_payable = Math.round(parseFloat(loan.total_payable) + penaltyAmount);
    loan.total_interest = Math.round(parseFloat(loan.total_interest) + penaltyAmount);
    loan.total_penalties = Math.round((parseFloat(loan.total_penalties) || 0) + penaltyAmount);
    loan.penalty_count = nextCycle;
    loan.penalty_applied = true;
    loan.notes = (loan.notes ? loan.notes + ' ' : '') + `[Penalty Cycle #${nextCycle}: Rs. ${penaltyAmount} (${rate}% overdue penalty on remaining Rs. ${rem})]`;

    let stepDays = 1;
    if (loan.frequency === 'WEEKLY') stepDays = 7;
    if (loan.frequency === 'MONTHLY') stepDays = 30;
    const start = new Date(loan.start_date || loan.created_at);

    const targetSlots = Math.max(parseInt(loan.installment_count, 10) || 58, (nextCycle + 1) * 58);
    const instAmt = parseFloat(loan.installment_amount) || 100;

    const loanInsts = localStore.installments.filter(i => i.loan_id === id);
    const maxExistingNo = loanInsts.length ? Math.max(...loanInsts.map(i => i.installment_no)) : 58;

    loanInsts.filter(i => i.status === 'BLANK').forEach(blank => {
      blank.expected_amount = instAmt;
      blank.status = 'PENDING';
    });

    for (let i = maxExistingNo + 1; i <= targetSlots; i++) {
      const instDate = new Date(start.getTime() + (i - 1) * stepDays * 86400000);
      const instId = localStore.installments.length ? Math.max(...localStore.installments.map(inst => inst.id)) + 1 : 1;
      localStore.installments.push({
        id: instId,
        loan_id: id,
        installment_no: i,
        due_date: instDate.toISOString().split('T')[0],
        expected_amount: instAmt,
        paid_amount: 0.00,
        status: 'PENDING'
      });
    }

    loan.installment_count = targetSlots;
    const finalInst = localStore.installments
      .filter(i => i.loan_id === id)
      .sort((a, b) => b.installment_no - a.installment_no)[0];
    if (finalInst) loan.end_date = finalInst.due_date;

    saveLocalStore();
    return loan;
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
          let expected = parseFloat(inst.expected_amount);
          if (expected <= 0) {
            expected = Math.min(parseFloat(loan.installment_amount) || payAmount, unallocated);
          }
          const needed = Math.round((expected - parseFloat(inst.paid_amount)) * 100) / 100;
          if (needed <= 0) continue;

          if (affectedInstallmentNo === null) {
            affectedInstallmentNo = inst.installment_no;
          }

          if (unallocated >= needed) {
            await client.query(
              `UPDATE installments SET expected_amount = $1, paid_amount = $1, status = 'PAID' WHERE id = $2`,
              [expected, inst.id]
            );
            unallocated = Math.round((unallocated - needed) * 100) / 100;
          } else {
            const newPaid = Math.round((parseFloat(inst.paid_amount) + unallocated) * 100) / 100;
            await client.query(
              `UPDATE installments SET expected_amount = $1, paid_amount = $2, status = 'PARTIAL' WHERE id = $3`,
              [expected, newPaid, inst.id]
            );
            unallocated = 0;
          }
        }

        // If loan is fully repaid, blank out any remaining unpaid slots
        if (newBalance <= 0) {
          await client.query(
            `UPDATE installments 
             SET expected_amount = 0.00, status = 'BLANK' 
             WHERE loan_id = $1 AND status != 'PAID'`,
            [loan_id]
          );
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
            payment_type, payment_method, notes, installment_no
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            receiptNo, loan_id, loan.client_id, collector_id,
            payAmount, prevBalance, newBalance,
            isPartial ? 'PARTIAL' : 'FULL', payment_method, notes,
            affectedInstallmentNo || 1
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
           WHERE loan_id = $1 AND status NOT IN ('PAID', 'BLANK') AND expected_amount > 0 
           ORDER BY installment_no ASC LIMIT 1`,
          [loan_id]
        );

        await client.query('COMMIT');

        const pCount = parseInt(loan.penalty_count, 10) || (loan.penalty_applied ? 1 : 0);
        return {
          ...payment,
          loan_code: loan.loan_code,
          installment_count: loan.installment_count,
          current_installment_no: affectedInstallmentNo || 1,
          installment_no: affectedInstallmentNo || 1,
          client_name: clientInfo.name,
          client_phone: clientInfo.phone,
          collector_name: collectorInfo ? collectorInfo.name : 'Collector',
          next_due_date: nextInstRes.rows.length ? (nextInstRes.rows[0].due_date instanceof Date ? nextInstRes.rows[0].due_date.toISOString().split('T')[0] : String(nextInstRes.rows[0].due_date).split('T')[0]) : 'Completed',
          next_due_amount: nextInstRes.rows.length ? (parseFloat(nextInstRes.rows[0].expected_amount) - parseFloat(nextInstRes.rows[0].paid_amount)) : 0,
          penalty_applied: Boolean(loan.penalty_applied || pCount > 0),
          penalty_count: pCount,
          total_penalties: parseFloat(loan.total_penalties || 0),
          loan_notes: loan.notes || ''
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
      let expected = parseFloat(inst.expected_amount);
      if (expected <= 0) {
        expected = Math.min(parseFloat(loan.installment_amount) || payAmount, unallocated);
        inst.expected_amount = expected;
      }
      const needed = Math.round((expected - parseFloat(inst.paid_amount)) * 100) / 100;
      if (needed <= 0) continue;

      if (affectedInstallmentNo === null) {
        affectedInstallmentNo = inst.installment_no;
      }

      if (unallocated >= needed) {
        inst.paid_amount = expected;
        inst.status = 'PAID';
        unallocated = Math.round((unallocated - needed) * 100) / 100;
      } else {
        inst.paid_amount = Math.round((parseFloat(inst.paid_amount) + unallocated) * 100) / 100;
        inst.status = 'PARTIAL';
        unallocated = 0;
      }
    }

    // If loan is fully repaid, blank out any remaining unpaid slots
    if (newBalance <= 0) {
      localStore.installments
        .filter(i => i.loan_id === loan.id && i.status !== 'PAID')
        .forEach(i => {
          i.expected_amount = 0.00;
          i.status = 'BLANK';
        });
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
      installment_no: affectedInstallmentNo || 1,
      created_at: new Date().toISOString()
    };
    localStore.payments.push(newPayment);
    saveLocalStore();

    const clientInfo = localStore.clients.find(c => c.id === loan.client_id) || {};
    const collectorInfo = localStore.users.find(u => u.id === parseInt(collector_id, 10)) || {};
    const nextInst = localStore.installments
      .filter(i => i.loan_id === loan.id && i.status !== 'PAID' && i.status !== 'BLANK' && parseFloat(i.expected_amount) > 0)
      .sort((a, b) => a.installment_no - b.installment_no)[0];

    const pCount = parseInt(loan.penalty_count, 10) || (loan.penalty_applied ? 1 : 0);
    return {
      ...newPayment,
      loan_code: loan.loan_code,
      installment_count: loan.installment_count,
      current_installment_no: affectedInstallmentNo || 1,
      installment_no: affectedInstallmentNo || 1,
      client_name: clientInfo.name || 'Client',
      client_phone: clientInfo.phone || '',
      collector_name: collectorInfo.name || 'Collector',
      next_due_date: nextInst ? (nextInst.due_date instanceof Date ? nextInst.due_date.toISOString().split('T')[0] : String(nextInst.due_date).split('T')[0]) : 'Completed',
      next_due_amount: nextInst ? (parseFloat(nextInst.expected_amount) - parseFloat(nextInst.paid_amount)) : 0,
      penalty_applied: Boolean(loan.penalty_applied || pCount > 0),
      penalty_count: pCount,
      total_penalties: parseFloat(loan.total_penalties || 0),
      loan_notes: loan.notes || ''
    };
  },

  // LEAN NOTIFICATION & REMINDER CALCULATOR (No cloud storage waste)
  getReminders: async (userId, role) => {
    await db.autoApplyOverduePenalties();
    loadLocalStore();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

    let loans = [];
    let penaltyLoansList = [];

    if (usePostgres) {
      let query = `
        SELECT l.id AS loan_id, l.loan_code, l.installment_amount, l.remaining_balance, l.assigned_agent_id,
               c.name AS client_name, c.phone AS client_phone,
               i.id AS installment_id, i.installment_no,
               TO_CHAR(i.due_date, 'YYYY-MM-DD') AS due_date,
               i.expected_amount, i.paid_amount, i.status AS inst_status
        FROM installments i
        JOIN loans l ON i.loan_id = l.id
        JOIN clients c ON l.client_id = c.id
        WHERE l.status = 'ACTIVE' AND i.status NOT IN ('PAID', 'BLANK') AND i.expected_amount > 0
        ORDER BY i.installment_no ASC
      `;
      const res = await pgPool.query(query);
      loans = res.rows;

      const penaltyRes = await pgPool.query(`
        SELECT l.id AS loan_id, l.loan_code, l.installment_amount, l.remaining_balance, l.end_date, l.notes,
               COALESCE(l.penalty_count, 1) AS penalty_count, COALESCE(l.total_penalties, 0) AS total_penalties,
               c.name AS client_name, c.phone AS client_phone
        FROM loans l
        JOIN clients c ON l.client_id = c.id
        WHERE l.status = 'ACTIVE' 
          AND l.remaining_balance > 0 
          AND (l.end_date < $1 OR l.notes LIKE '%[Penalty%' OR l.penalty_applied = TRUE OR COALESCE(l.penalty_count, 0) > 0)
        ORDER BY l.end_date ASC
      `, [todayStr]);
      penaltyLoansList = penaltyRes.rows;
    } else {
      const activeLoans = localStore.loans.filter(l => l.status === 'ACTIVE');

      loans = [];
      for (const loan of activeLoans) {
        const client = localStore.clients.find(c => c.id === loan.client_id) || {};
        const pendingInsts = localStore.installments.filter(i => i.loan_id === loan.id && i.status !== 'PAID' && i.status !== 'BLANK' && parseFloat(i.expected_amount) > 0);
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

      penaltyLoansList = (localStore.loans || [])
        .filter(l => l.status === 'ACTIVE' && parseFloat(l.remaining_balance) > 0 && (
          (l.end_date && todayStr > l.end_date) || (l.notes && l.notes.includes('[Penalty')) || l.penalty_applied || (l.penalty_count > 0)
        ))
        .map(l => {
          const client = localStore.clients.find(c => c.id === l.client_id) || {};
          return {
            loan_id: l.id,
            loan_code: l.loan_code,
            installment_amount: l.installment_amount,
            remaining_balance: l.remaining_balance,
            end_date: l.end_date,
            notes: l.notes,
            penalty_count: l.penalty_count || 1,
            total_penalties: l.total_penalties || 0,
            client_name: client.name || 'Unknown',
            client_phone: client.phone || ''
          };
        });
    }

    const dueTodayMap = new Map();
    const overdueMap = new Map();

    const toCleanDate = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val.split('T')[0];
      if (val instanceof Date) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(val);
      }
      return String(val).split('T')[0];
    };

    for (const item of loans) {
      const balanceDue = Math.round((parseFloat(item.expected_amount) - parseFloat(item.paid_amount)) * 100) / 100;
      if (balanceDue <= 0) continue;

      const itemDueDate = toCleanDate(item.due_date);

      if (itemDueDate === todayStr) {
        if (!dueTodayMap.has(item.loan_id)) {
          dueTodayMap.set(item.loan_id, {
            ...item,
            due_date: itemDueDate,
            balance_due: balanceDue,
            urgency: 'HIGH',
            title: `Due Today: Inst #${item.installment_no}`,
            message: `${item.client_name} has Rs. ${Math.round(balanceDue).toLocaleString()} due today for ${item.loan_code}.`
          });
        }
      } else if (itemDueDate < todayStr) {
        const daysLate = Math.max(1, Math.floor((new Date(todayStr + 'T00:00:00') - new Date(itemDueDate + 'T00:00:00')) / 86400000));
        
        if (!overdueMap.has(item.loan_id)) {
          overdueMap.set(item.loan_id, {
            ...item,
            due_date: itemDueDate,
            balance_due: balanceDue,
            days_late: daysLate,
            missed_installments_count: 1,
            total_missed_amount: balanceDue,
            urgency: 'CRITICAL',
            title: `Overdue (${daysLate} days late): Inst #${item.installment_no}`,
            message: `${item.client_name} is ${daysLate} days late.`
          });
        } else {
          const existing = overdueMap.get(item.loan_id);
          existing.missed_installments_count = (existing.missed_installments_count || 1) + 1;
          existing.total_missed_amount = Math.round(((existing.total_missed_amount || existing.balance_due) + balanceDue) * 100) / 100;
          
          // Keep the highest days late (oldest missed installment)
          if (daysLate > existing.days_late) {
            existing.days_late = daysLate;
            existing.due_date = itemDueDate;
            existing.installment_no = item.installment_no;
          }
        }
      }
    }

    // Finalize total amount due to date (past missed installments + today's installment if due)
    for (const [loanId, overdueItem] of overdueMap.entries()) {
      const remainingBal = parseFloat(overdueItem.remaining_balance) || 0;
      const todayItem = dueTodayMap.get(loanId);
      const todayDueAmt = todayItem ? todayItem.balance_due : 0;

      const pastMissedAmt = Math.min(overdueItem.total_missed_amount, remainingBal);
      const totalToDate = Math.min(Math.round((pastMissedAmt + todayDueAmt) * 100) / 100, remainingBal);

      overdueItem.past_overdue_amount = pastMissedAmt;
      overdueItem.today_installment_amount = todayDueAmt;
      overdueItem.total_due_to_date = totalToDate;
      // balance_due reflects total amount they have to pay to that day
      overdueItem.balance_due = totalToDate;
      overdueItem.title = `Overdue (${overdueItem.days_late} days late): ${overdueItem.missed_installments_count} missed`;
      overdueItem.message = `${overdueItem.client_name} is ${overdueItem.days_late} days late (${overdueItem.missed_installments_count} missed). Total to pay to date: Rs. ${Math.round(totalToDate).toLocaleString()}.`;
    }

    for (const [loanId, todayItem] of dueTodayMap.entries()) {
      const overdueItem = overdueMap.get(loanId);
      if (overdueItem) {
        todayItem.past_overdue_amount = overdueItem.past_overdue_amount;
        todayItem.missed_installments_count = overdueItem.missed_installments_count;
        todayItem.total_due_to_date = overdueItem.total_due_to_date;
      } else {
        todayItem.past_overdue_amount = 0;
        todayItem.missed_installments_count = 0;
        todayItem.total_due_to_date = todayItem.balance_due;
      }
    }

    const penalties = penaltyLoansList.map(item => {
      const daysOverdue = item.end_date ? Math.max(1, Math.floor((new Date(todayStr) - new Date(item.end_date)) / 86400000)) : 1;
      const count = parseInt(item.penalty_count, 10) || 1;
      return {
        ...item,
        urgency: 'PENALTY',
        days_overdue: daysOverdue,
        title: `${count * 8}% Overdue Penalty (${count}x 58-Cycles)`,
        message: `${item.client_name} exceeded ${count * 58} installments (${daysOverdue} days overdue). ${count}x 8% overdue penalties applied. Outstanding: Rs. ${Math.round(parseFloat(item.remaining_balance)).toLocaleString()}.`
      };
    });

    // Enforce strict single-category hierarchy:
    // 1. Penalties accounts ONLY show in Penalties
    const penaltyLoanIds = new Set(penalties.map(p => String(p.loan_id)));

    // 2. Overdue accounts ONLY show in Overdue (and not in Penalties)
    const overdue = Array.from(overdueMap.values())
      .filter(item => !penaltyLoanIds.has(String(item.loan_id)))
      .sort((a, b) => b.days_late - a.days_late);

    const overdueLoanIds = new Set(overdue.map(o => String(o.loan_id)));

    // 3. Due today accounts ONLY show in Scheduled For Today (and not in Penalties or Overdue)
    const dueToday = Array.from(dueTodayMap.values())
      .filter(item => !penaltyLoanIds.has(String(item.loan_id)) && !overdueLoanIds.has(String(item.loan_id)));

    return {
      due_today_count: dueToday.length,
      overdue_count: overdue.length,
      penalties_count: penalties.length,
      total_count: dueToday.length + overdue.length + penalties.length,
      due_today: dueToday,
      overdue: overdue,
      penalties: penalties
    };
  },

  // FINANCIAL DASHBOARD SUMMARY
  getDashboardMetrics: async () => {
    await db.autoApplyOverduePenalties();
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
  },

  // MONTHLY FINANCIAL REPORT & ANALYTICS
  getMonthlyReport: async (yearMonth) => {
    await db.autoApplyOverduePenalties();
    loadLocalStore();
    const targetMonth = yearMonth || new Date().toISOString().slice(0, 7);

    if (usePostgres) {
      const totalsRes = await pgPool.query(`
        SELECT 
          COALESCE(SUM(amount_paid), 0) AS total_collected,
          COUNT(*) AS total_payments_count,
          COUNT(DISTINCT client_id) AS unique_clients_paid
        FROM payments
        WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
      `, [targetMonth]);

      const loansRes = await pgPool.query(`
        SELECT 
          COALESCE(SUM(principal_amount), 0) AS total_disbursed,
          COALESCE(SUM(total_interest), 0) AS total_interest_earned,
          COUNT(*) AS new_loans_count
        FROM loans
        WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
      `, [targetMonth]);

      const dailyRes = await pgPool.query(`
        SELECT 
          EXTRACT(DAY FROM created_at)::int AS day,
          TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
          COALESCE(SUM(amount_paid), 0) AS amount,
          COUNT(*) AS count
        FROM payments
        WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
        GROUP BY EXTRACT(DAY FROM created_at), TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY day ASC
      `, [targetMonth]);

      const collectorRes = await pgPool.query(`
        SELECT 
          p.collector_id,
          COALESCE(u.name, 'Unknown') AS collector_name,
          COALESCE(SUM(p.amount_paid), 0) AS total_collected,
          COUNT(*) AS receipts_count
        FROM payments p
        LEFT JOIN users u ON p.collector_id = u.id
        WHERE TO_CHAR(p.created_at, 'YYYY-MM') = $1
        GROUP BY p.collector_id, u.name
        ORDER BY total_collected DESC
      `, [targetMonth]);

      const methodRes = await pgPool.query(`
        SELECT 
          payment_method,
          COALESCE(SUM(amount_paid), 0) AS amount,
          COUNT(*) AS count
        FROM payments
        WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
        GROUP BY payment_method
      `, [targetMonth]);

      return {
        month: targetMonth,
        total_collected: parseFloat(totalsRes.rows[0]?.total_collected || 0),
        total_payments_count: parseInt(totalsRes.rows[0]?.total_payments_count || 0, 10),
        unique_clients_paid: parseInt(totalsRes.rows[0]?.unique_clients_paid || 0, 10),
        total_disbursed: parseFloat(loansRes.rows[0]?.total_disbursed || 0),
        total_interest_earned: parseFloat(loansRes.rows[0]?.total_interest_earned || 0),
        new_loans_count: parseInt(loansRes.rows[0]?.new_loans_count || 0, 10),
        daily_breakdown: dailyRes.rows.map(r => ({
          day: r.day,
          date: r.date,
          amount: parseFloat(r.amount),
          count: parseInt(r.count, 10)
        })),
        collectors_breakdown: collectorRes.rows.map(r => ({
          collector_id: r.collector_id,
          collector_name: r.collector_name,
          total_collected: parseFloat(r.total_collected),
          receipts_count: parseInt(r.receipts_count, 10)
        })),
        methods_breakdown: methodRes.rows.map(r => ({
          payment_method: r.payment_method,
          amount: parseFloat(r.amount),
          count: parseInt(r.count, 10)
        }))
      };
    }

    // LocalStore fallback
    const monthPayments = localStore.payments.filter(p => (p.created_at || '').startsWith(targetMonth));
    const monthLoans = localStore.loans.filter(l => (l.created_at || '').startsWith(targetMonth));

    const totalCollected = monthPayments.reduce((acc, p) => acc + parseFloat(p.amount_paid || 0), 0);
    const uniqueClients = new Set(monthPayments.map(p => p.client_id)).size;
    const totalDisbursed = monthLoans.reduce((acc, l) => acc + parseFloat(l.principal_amount || 0), 0);
    const totalInterestEarned = monthLoans.reduce((acc, l) => acc + parseFloat(l.total_interest || 0), 0);

    const dailyMap = {};
    for (const p of monthPayments) {
      const dateStr = (p.created_at || '').slice(0, 10);
      const day = parseInt(dateStr.slice(8, 10), 10) || 1;
      if (!dailyMap[day]) {
        dailyMap[day] = { day, date: dateStr, amount: 0, count: 0 };
      }
      dailyMap[day].amount += parseFloat(p.amount_paid || 0);
      dailyMap[day].count += 1;
    }
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.day - b.day);

    const collectorMap = {};
    for (const p of monthPayments) {
      const cId = p.collector_id;
      if (!collectorMap[cId]) {
        const u = localStore.users.find(usr => usr.id === cId);
        collectorMap[cId] = {
          collector_id: cId,
          collector_name: u ? u.name : 'Collector',
          total_collected: 0,
          receipts_count: 0
        };
      }
      collectorMap[cId].total_collected += parseFloat(p.amount_paid || 0);
      collectorMap[cId].receipts_count += 1;
    }
    const collectorsBreakdown = Object.values(collectorMap).sort((a, b) => b.total_collected - a.total_collected);

    const methodMap = {};
    for (const p of monthPayments) {
      const m = p.payment_method || 'CASH';
      if (!methodMap[m]) methodMap[m] = { payment_method: m, amount: 0, count: 0 };
      methodMap[m].amount += parseFloat(p.amount_paid || 0);
      methodMap[m].count += 1;
    }

    return {
      month: targetMonth,
      total_collected: Math.round(totalCollected * 100) / 100,
      total_payments_count: monthPayments.length,
      unique_clients_paid: uniqueClients,
      total_disbursed: Math.round(totalDisbursed * 100) / 100,
      total_interest_earned: Math.round(totalInterestEarned * 100) / 100,
      new_loans_count: monthLoans.length,
      daily_breakdown: dailyBreakdown,
      collectors_breakdown: collectorsBreakdown,
      methods_breakdown: Object.values(methodMap)
    };
  },

  // MASTER TRANSACTIONS & RECEIPTS LEDGER
  getAllTransactions: async ({ month, search, payment_method, limit = 200, offset = 0 } = {}) => {
    await db.autoApplyOverduePenalties();
    loadLocalStore();

    if (usePostgres) {
      let query = `
        SELECT 
          p.*,
          COALESCE(p.installment_no, 1) AS current_installment_no,
          l.loan_code,
          l.installment_amount,
          l.installment_count,
          l.penalty_applied,
          COALESCE(l.penalty_count, 0) AS penalty_count,
          COALESCE(l.total_penalties, 0) AS total_penalties,
          l.notes AS loan_notes,
          c.name AS client_name,
          c.phone AS client_phone,
          c.nic_id AS client_nic,
          COALESCE(u.name, 'Collector') AS collector_name
        FROM payments p
        JOIN loans l ON p.loan_id = l.id
        JOIN clients c ON p.client_id = c.id
        LEFT JOIN users u ON p.collector_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (month && month !== 'ALL') {
        params.push(month);
        query += ` AND TO_CHAR(p.created_at, 'YYYY-MM') = $${params.length}`;
      }

      if (payment_method && payment_method !== 'ALL') {
        params.push(payment_method);
        query += ` AND p.payment_method = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (
          LOWER(p.receipt_no) LIKE $${params.length} OR
          LOWER(c.name) LIKE $${params.length} OR
          LOWER(c.phone) LIKE $${params.length} OR
          LOWER(COALESCE(c.nic_id, '')) LIKE $${params.length} OR
          LOWER(l.loan_code) LIKE $${params.length} OR
          LOWER(COALESCE(u.name, '')) LIKE $${params.length}
        )`;
      }

      query += ` ORDER BY p.created_at DESC, p.id DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

      const res = await pgPool.query(query, params);
      return res.rows;
    }

    // LocalStore fallback
    let transactions = localStore.payments.map(p => {
      const loan = localStore.loans.find(l => l.id === p.loan_id) || {};
      const client = localStore.clients.find(c => c.id === p.client_id) || {};
      const user = localStore.users.find(u => u.id === p.collector_id) || {};
      const pCount = parseInt(loan.penalty_count, 10) || (loan.penalty_applied ? 1 : 0);
      return {
        ...p,
        current_installment_no: p.installment_no || 1,
        loan_code: loan.loan_code || 'LN-UNKNOWN',
        installment_amount: loan.installment_amount || 0,
        installment_count: loan.installment_count || 58,
        penalty_applied: Boolean(loan.penalty_applied || pCount > 0),
        penalty_count: pCount,
        total_penalties: parseFloat(loan.total_penalties || 0),
        loan_notes: loan.notes || '',
        client_name: client.name || 'Unknown Client',
        client_phone: client.phone || '',
        client_nic: client.nic_id || '',
        collector_name: user.name || 'Collector'
      };
    });

    if (month && month !== 'ALL') {
      transactions = transactions.filter(t => (t.created_at || '').startsWith(month));
    }

    if (payment_method && payment_method !== 'ALL') {
      transactions = transactions.filter(t => t.payment_method === payment_method);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      transactions = transactions.filter(t => 
        (t.receipt_no || '').toLowerCase().includes(q) ||
        (t.client_name || '').toLowerCase().includes(q) ||
        (t.client_phone || '').toLowerCase().includes(q) ||
        (t.client_nic || '').toLowerCase().includes(q) ||
        (t.loan_code || '').toLowerCase().includes(q) ||
        (t.collector_name || '').toLowerCase().includes(q)
      );
    }

    transactions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return transactions.slice(offset, offset + limit);
  },

  logAudit: async ({ user_id = null, username = 'SYSTEM', action, details = '', ip_address = '' }) => {
    try {
      const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
      if (usePostgres) {
        await pgPool.query(
          'INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
          [user_id, username, action, detailsStr, ip_address]
        );
      } else {
        loadLocalStore();
        if (!localStore.audit_logs) localStore.audit_logs = [];
        localStore.audit_logs.push({
          id: localStore.audit_logs.length + 1,
          user_id,
          username,
          action,
          details: detailsStr,
          ip_address,
          created_at: new Date().toISOString()
        });
        saveLocalStore();
      }
    } catch (e) {
      console.error('Audit log error:', e.message);
    }
  },

  getAuditLogs: async (limit = 100) => {
    try {
      if (usePostgres) {
        const res = await pgPool.query(
          'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1',
          [limit]
        );
        return res.rows;
      }
      loadLocalStore();
      return (localStore.audit_logs || [])
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    } catch (e) {
      console.error('Error fetching audit logs:', e.message);
      return [];
    }
  }
};

module.exports = { initDb, db };
