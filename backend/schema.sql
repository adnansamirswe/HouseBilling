-- HousBilling v2 - Database Schema
-- Run: wrangler d1 execute housbilling-db --file=./schema.sql

-- Drop existing tables if any
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS other_bills;
DROP TABLE IF EXISTS meter_readings;
DROP TABLE IF EXISTS tenants;

-- Tenants table
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    room_number TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    base_rent INTEGER NOT NULL DEFAULT 3000,
    electric_rate REAL NOT NULL DEFAULT 9.0,
    advance_required INTEGER NOT NULL DEFAULT 1,
    advance_amount INTEGER NOT NULL DEFAULT 0,
    advance_paid INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_month TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Meter readings table
CREATE TABLE meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    reading_value INTEGER NOT NULL,
    previous_value INTEGER NOT NULL DEFAULT 0,
    units INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    image_key TEXT,
    month_year TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Other bills (customizable recurring or one-time charges)
CREATE TABLE other_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    month_year TEXT NOT NULL,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Monthly invoices
CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    tenant_name TEXT,
    room_number TEXT,
    month_year TEXT NOT NULL,
    rent_amount INTEGER NOT NULL DEFAULT 0,
    electric_amount REAL NOT NULL DEFAULT 0,
    other_total INTEGER NOT NULL DEFAULT 0,
    total_due REAL NOT NULL DEFAULT 0,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    is_fully_paid INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    UNIQUE(tenant_id, month_year)
);

-- Admin credentials (simple password storage)
CREATE TABLE admin (
    id INTEGER PRIMARY KEY,
    password TEXT NOT NULL DEFAULT 'admin123'
);

-- Insert default admin
INSERT INTO admin (id, password) VALUES (1, 'admin123');

-- Indexes
CREATE INDEX idx_readings_tenant ON meter_readings(tenant_id);
CREATE INDEX idx_readings_month ON meter_readings(month_year);
CREATE INDEX idx_bills_tenant ON other_bills(tenant_id);
CREATE INDEX idx_bills_month ON other_bills(month_year);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_month ON invoices(month_year);
