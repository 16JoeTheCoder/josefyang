-- 0001_init.sql (architecture §6.2)
CREATE TABLE pages (
  id             TEXT PRIMARY KEY,
  draft_json     TEXT NOT NULL,
  published_json TEXT,
  updated_at     INTEGER NOT NULL,
  published_at   INTEGER
);

CREATE TABLE templates (
  id            TEXT NOT NULL,
  version       INTEGER NOT NULL,
  name          TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (id, version)
);

CREATE TABLE builds (
  id             TEXT PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('hardware','software')),
  status         TEXT NOT NULL CHECK (status IN ('bench','in_progress','finished','failed')),
  featured       INTEGER NOT NULL DEFAULT 0,
  case_file      INTEGER NOT NULL DEFAULT 0,
  template_id    TEXT NOT NULL,
  template_ver   INTEGER NOT NULL,
  home_order     INTEGER,
  summary        TEXT,
  skills_json    TEXT NOT NULL DEFAULT '[]',
  draft_json     TEXT NOT NULL,
  published_json TEXT,
  started_on     TEXT,
  finished_on    TEXT,
  updated_at     INTEGER NOT NULL,
  published_at   INTEGER,
  FOREIGN KEY (template_id, template_ver) REFERENCES templates(id, version)
);

CREATE TABLE devlog (
  id           TEXT PRIMARY KEY,
  build_id     TEXT REFERENCES builds(id),
  body         TEXT NOT NULL,
  media_ids    TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft',
  created_at   INTEGER NOT NULL,
  published_at INTEGER
);

CREATE TABLE milestones (
  id     TEXT PRIMARY KEY,
  date   TEXT NOT NULL,
  title  TEXT NOT NULL,
  body   TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE media (
  id            TEXT PRIMARY KEY,
  original_key  TEXT NOT NULL,
  variants_json TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  alt_default   TEXT,
  bytes         INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE media_usage (
  media_id   TEXT NOT NULL REFERENCES media(id),
  owner_type TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  field_path TEXT NOT NULL,
  PRIMARY KEY (media_id, owner_type, owner_id, field_path)
);

CREATE TABLE versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type    TEXT NOT NULL,
  owner_id      TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  reason        TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE settings (
  key            TEXT PRIMARY KEY,
  draft_json     TEXT NOT NULL,
  published_json TEXT,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX idx_builds_status ON builds(status);
CREATE INDEX idx_builds_featured ON builds(featured);
CREATE INDEX idx_usage_owner ON media_usage(owner_type, owner_id);
CREATE INDEX idx_versions_owner ON versions(owner_type, owner_id, created_at);
