-- 0002: devlog entry fields (architecture §0.2), build floor + title fields (§0.5), milestone label.
ALTER TABLE devlog ADD COLUMN slug TEXT;
ALTER TABLE devlog ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE devlog ADD COLUMN excerpt TEXT NOT NULL DEFAULT '';
ALTER TABLE devlog ADD COLUMN hero_media_id TEXT;
ALTER TABLE devlog ADD COLUMN fuse_url TEXT;
ALTER TABLE devlog ADD COLUMN read_minutes INTEGER;
ALTER TABLE devlog ADD COLUMN entry_date TEXT;
ALTER TABLE devlog ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_devlog_slug ON devlog(slug);
CREATE INDEX idx_devlog_status_date ON devlog(status, entry_date);

ALTER TABLE builds ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE builds ADD COLUMN deleted_at INTEGER;

ALTER TABLE milestones ADD COLUMN label TEXT NOT NULL DEFAULT '';
