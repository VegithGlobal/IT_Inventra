-- IT Asset & Expense Management System - Schema

CREATE TYPE user_role AS ENUM ('admin', 'it_support', 'employee');
CREATE TYPE asset_status AS ENUM ('In Use', 'In Stock', 'Lost', 'Damaged', 'Under Repair', 'Disposed');
CREATE TYPE ticket_status AS ENUM ('Open', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE ticket_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE ticket_category AS ENUM ('Hardware Issue', 'Software Issue', 'New Request', 'Asset Return', 'Other');
CREATE TYPE expense_category AS ENUM ('Repair', 'Replacement', 'Purchase', 'AMC', 'Accessory', 'Other');

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'employee',
    department      VARCHAR(100),
    location        VARCHAR(100),
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE asset_types (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE assets (
    id                  SERIAL PRIMARY KEY,
    asset_no            VARCHAR(50) UNIQUE NOT NULL,      -- e.g. Asset_001
    asset_type          VARCHAR(100) NOT NULL,
    company              VARCHAR(100),                     -- Vegith / MLPL etc.
    brand               VARCHAR(100),
    model               VARCHAR(150),
    serial_number       VARCHAR(150),
    processor           VARCHAR(100),
    ram                 VARCHAR(50),
    storage             VARCHAR(100),
    status              asset_status NOT NULL DEFAULT 'In Stock',
    current_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    current_user_name   VARCHAR(150),                      -- fallback free text (legacy data has non-system users)
    department          VARCHAR(100),
    location            VARCHAR(100),
    inventory_flag      BOOLEAN DEFAULT TRUE,
    condition_report    TEXT,
    remark              TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_assets_asset_no ON assets(asset_no);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_user ON assets(current_user_name);
CREATE INDEX idx_assets_location ON assets(location);

CREATE TABLE asset_user_history (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_name       VARCHAR(150) NOT NULL,
    assigned_on     TIMESTAMP DEFAULT NOW(),
    returned_on     TIMESTAMP,
    remark          TEXT
);
CREATE INDEX idx_history_asset ON asset_user_history(asset_id);

CREATE TABLE expenses (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER REFERENCES assets(id) ON DELETE SET NULL,  -- nullable = general company expense
    expense_date    DATE NOT NULL,
    category        expense_category NOT NULL,
    description     TEXT,
    amount          NUMERIC(12,2) NOT NULL,
    vendor          VARCHAR(150),
    paid_by         VARCHAR(150),
    attachment_url  VARCHAR(500),
    department      VARCHAR(100),
    location        VARCHAR(100),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_expenses_asset ON expenses(asset_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

CREATE TABLE tickets (
    id              SERIAL PRIMARY KEY,
    ticket_no       VARCHAR(30) UNIQUE NOT NULL,         -- e.g. TKT-00001
    raised_by       INTEGER NOT NULL REFERENCES users(id),
    category        ticket_category NOT NULL,
    asset_id        INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    description     TEXT NOT NULL,
    priority        ticket_priority NOT NULL DEFAULT 'Medium',
    status          ticket_status NOT NULL DEFAULT 'Open',
    assigned_to     INTEGER REFERENCES users(id),
    attachment_url  VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    resolved_at     TIMESTAMP
);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_raised_by ON tickets(raised_by);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);

CREATE TABLE ticket_comments (
    id          SERIAL PRIMARY KEY,
    ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    comment     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id);

-- Auto-update updated_at on assets/tickets
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
