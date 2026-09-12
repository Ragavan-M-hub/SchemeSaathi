-- server/db/schema.sql
-- SchemeSaathi relational schema (SQLite / node:sqlite).
-- Money is stored in whole rupees (INTEGER); rates are percent per annum (REAL).
-- Timestamps are ISO-8601 UTC strings so they round-trip through JSON cleanly.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'applicant'
                    CHECK (role IN ('applicant', 'officer', 'admin')),
  social_category TEXT NOT NULL DEFAULT 'SC',
  state           TEXT,
  district        TEXT,
  preferred_lang  TEXT NOT NULL DEFAULT 'en',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- One row per user: the answers given to the recommender plus journey progress.
-- This replaces the localStorage-only journey of the client-side prototype.
CREATE TABLE IF NOT EXISTS profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  purpose         TEXT,
  project_type    TEXT,
  cost            INTEGER,
  income          INTEGER,
  education       TEXT,
  gender          TEXT,
  lat             REAL,
  lng             REAL,
  location_label  TEXT,
  steps_completed TEXT NOT NULL DEFAULT '{}',   -- JSON: {recommender,emi,partners}
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schemes (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  nodal_agency      TEXT NOT NULL,
  category          TEXT NOT NULL,
  description       TEXT NOT NULL,
  loan_min          INTEGER NOT NULL,
  loan_max          INTEGER NOT NULL,
  income_ceiling    INTEGER NOT NULL,
  interest_min      REAL NOT NULL,
  interest_max      REAL NOT NULL,
  moratorium_months INTEGER NOT NULL DEFAULT 0,
  tenure_years      INTEGER NOT NULL DEFAULT 5,
  eligible_types    TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  documents         TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  apply_url         TEXT,
  name_key          TEXT,
  description_key   TEXT,
  purposes          TEXT NOT NULL DEFAULT '[]',  -- JSON array of purpose slugs
  min_education     TEXT NOT NULL DEFAULT 'none',
  women_only        INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes (category, active);

CREATE TABLE IF NOT EXISTS partners (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL,
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  lat                 REAL NOT NULL,
  lng                 REAL NOT NULL,
  health              TEXT NOT NULL CHECK (health IN ('Healthy', 'Caution', 'High NPA')),
  npa_percent         REAL,
  avg_processing_days INTEGER,
  contact             TEXT,
  url                 TEXT,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partners_state ON partners (state, active);

CREATE TABLE IF NOT EXISTS partner_schemes (
  partner_id TEXT NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  scheme_id  TEXT NOT NULL REFERENCES schemes (id) ON DELETE CASCADE,
  PRIMARY KEY (partner_id, scheme_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_schemes_scheme ON partner_schemes (scheme_id);

-- Glossary is keyed by (term, language) so new languages are pure data.
CREATE TABLE IF NOT EXISTS glossary (
  term_key   TEXT NOT NULL,
  lang       TEXT NOT NULL,
  term       TEXT NOT NULL,
  plain      TEXT NOT NULL,
  example    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (term_key, lang)
);

-- Mock geocoder store: city names and pincode prefixes -> coordinates.
CREATE TABLE IF NOT EXISTS geo_places (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  kind  TEXT NOT NULL CHECK (kind IN ('city', 'pincode_prefix')),
  key   TEXT NOT NULL,
  label TEXT NOT NULL,
  lat   REAL NOT NULL,
  lng   REAL NOT NULL,
  state TEXT,
  UNIQUE (kind, key)
);

CREATE TABLE IF NOT EXISTS personas (
  id          TEXT PRIMARY KEY,
  emoji       TEXT NOT NULL,
  labels      TEXT NOT NULL DEFAULT '{}',  -- JSON: {en,hi,mr}
  form        TEXT NOT NULL DEFAULT '{}',  -- JSON: recommender answers
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Every recommender run is recorded, with the exact inputs and the scored
-- output. Anonymous runs are allowed (user_id NULL) so guests can try the tool.
CREATE TABLE IF NOT EXISTS recommendation_runs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  input      TEXT NOT NULL,   -- JSON
  results    TEXT NOT NULL,   -- JSON: [{schemeId, score, coveragePct, reasons}]
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_user ON recommendation_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS applications (
  id                TEXT PRIMARY KEY,
  reference_no      TEXT NOT NULL UNIQUE,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scheme_id         TEXT NOT NULL REFERENCES schemes (id),
  partner_id        TEXT REFERENCES partners (id),
  amount_requested  INTEGER NOT NULL,
  tenure_years      INTEGER NOT NULL,
  interest_rate     REAL NOT NULL,
  moratorium_months INTEGER NOT NULL DEFAULT 0,
  emi               INTEGER,
  purpose_note      TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'submitted', 'under_review',
                                        'documents_pending', 'approved',
                                        'rejected', 'disbursed', 'withdrawn')),
  officer_note      TEXT,
  submitted_at      TEXT,
  decided_at        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_apps_user ON applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications (status, created_at DESC);

-- The document checklist is derived from the scheme at creation time, then
-- tracked per application so an officer can verify items one by one.
CREATE TABLE IF NOT EXISTS application_documents (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'uploaded', 'verified', 'rejected')),
  file_name      TEXT,
  file_size      INTEGER,
  note           TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  uploaded_at    TEXT,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_docs_app ON application_documents (application_id, sort_order);

-- Append-only audit trail. Drives the status timeline in the UI.
CREATE TABLE IF NOT EXISTS application_events (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  note           TEXT,
  actor_user_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_role     TEXT,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_app ON application_events (application_id, created_at);

CREATE TABLE IF NOT EXISTS saved_schemes (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scheme_id  TEXT NOT NULL REFERENCES schemes (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, scheme_id)
);

CREATE TABLE IF NOT EXISTS emi_scenarios (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scheme_id         TEXT REFERENCES schemes (id) ON DELETE SET NULL,
  label             TEXT NOT NULL,
  principal         INTEGER NOT NULL,
  annual_rate       REAL NOT NULL,
  tenure_years      INTEGER NOT NULL,
  moratorium_months INTEGER NOT NULL DEFAULT 0,
  emi               INTEGER NOT NULL,
  total_interest    INTEGER NOT NULL,
  total_payment     INTEGER NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenarios_user ON emi_scenarios (user_id, created_at DESC);

-- Bookkeeping for the migration runner.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

