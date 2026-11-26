-- 0005: blog upgrade on the devlog table. `body` stays as the plain-text fallback.
ALTER TABLE devlog ADD COLUMN blocks_json TEXT;
ALTER TABLE devlog ADD COLUMN type TEXT NOT NULL DEFAULT 'note';
ALTER TABLE devlog ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE devlog ADD COLUMN sites_json TEXT NOT NULL DEFAULT '["main"]';
ALTER TABLE devlog ADD COLUMN game_slug TEXT;
ALTER TABLE devlog ADD COLUMN publish_at TEXT;
ALTER TABLE devlog ADD COLUMN seo_description TEXT;
CREATE INDEX idx_devlog_publish_at ON devlog(publish_at);
