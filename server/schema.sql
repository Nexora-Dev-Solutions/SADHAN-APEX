-- LoanPro PostgreSQL Database Schema
-- Run this in pgAdmin Query Tool if you want to initialize the tables manually

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
  business_type VARCHAR(100),
  kyc_status VARCHAR(20) DEFAULT 'VERIFIED',
  kyc_notes TEXT,
  photo_url TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to prevent duplicate NICs and Phones
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_nic ON clients (UPPER(TRIM(nic_id))) WHERE nic_id IS NOT NULL AND TRIM(nic_id) != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_phone ON clients (TRIM(phone)) WHERE phone IS NOT NULL AND TRIM(phone) != '';

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
