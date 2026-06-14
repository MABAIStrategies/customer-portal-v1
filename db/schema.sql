-- MAB Portal Generator — SQLite schema (Postgres/pgvector equivalent in comments)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  legal_entity TEXT,
  industry TEXT,
  website TEXT,
  logo_path TEXT,
  employee_count TEXT,
  service_area TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_method TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS engagements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT UNIQUE NOT NULL,
  company_id INTEGER,
  type TEXT,
  created_date TEXT,
  promo_days_signing INTEGER,
  promo_days_deployment INTEGER,
  promo_rule TEXT,
  status TEXT DEFAULT 'draft',
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT,
  item_id TEXT,
  selected_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposal_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT,
  snapshot_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT,
  stripe_payment_id TEXT,
  amount INTEGER,
  currency TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT,
  integration_key TEXT,
  status TEXT DEFAULT 'pending',
  config_json TEXT,
  connected_at TEXT
);

CREATE TABLE IF NOT EXISTS phase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT UNIQUE,
  name TEXT,
  description TEXT,
  category TEXT,
  roi_monthly REAL,
  hours_saved REAL,
  price_one_time REAL,
  price_monthly REAL,
  is_fulcrum INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT,
  action TEXT,
  payload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vector tables (sqlite-vec syntax; pgvector equivalent uses vector(1536))
CREATE TABLE IF NOT EXISTS item_catalog_vectors (
  item_id TEXT PRIMARY KEY,
  embedding BLOB,  -- 1536 floats serialized
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS engagement_vectors (
  engagement_id TEXT PRIMARY KEY,
  embedding BLOB,
  metadata TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_selections_engagement ON portal_selections(engagement_id);
