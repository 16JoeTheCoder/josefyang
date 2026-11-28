-- Phase 1 bounded reads: list queries filter on status and order by (entry_date DESC, created_at DESC) with a LIMIT.
-- This index lets SQLite stop after LIMIT rows instead of sorting every published row. Additive and safe to re-run.
CREATE INDEX IF NOT EXISTS idx_devlog_status_order ON devlog(status, entry_date DESC, created_at DESC);
