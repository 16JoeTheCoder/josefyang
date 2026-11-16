-- 0003: health log for broken sections and islands (architecture §11).
CREATE TABLE health (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  page    TEXT NOT NULL,
  section TEXT,
  module  TEXT,
  message TEXT NOT NULL
);
CREATE INDEX idx_health_at ON health(at);
