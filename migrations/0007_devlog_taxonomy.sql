-- Managed post taxonomy and private revisions for entries with published content.
CREATE TABLE devlog_taxonomy (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('category', 'tag')),
  name TEXT NOT NULL COLLATE NOCASE,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE (kind, name),
  UNIQUE (kind, slug)
);

INSERT INTO devlog_taxonomy (id, kind, name, slug, description)
VALUES ('category-failure', 'category', 'Failure', 'failure', 'Tests, prototypes and ideas that did not work out.');

ALTER TABLE devlog ADD COLUMN categories_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE devlog ADD COLUMN tag_ids_json TEXT;
ALTER TABLE devlog ADD COLUMN seo_title TEXT;
ALTER TABLE devlog ADD COLUMN draft_json TEXT;
ALTER TABLE devlog ADD COLUMN save_token TEXT;

-- Keep existing freeform tags, preserving display spelling and assigning stable IDs.
INSERT OR IGNORE INTO devlog_taxonomy (id, kind, name, slug)
SELECT 'legacy-tag-' || LOWER(HEX(LOWER(TRIM(tag.value)))),
       'tag',
       TRIM(tag.value),
       'tag-' || LOWER(HEX(LOWER(TRIM(tag.value))))
FROM devlog d, JSON_EACH(CASE WHEN JSON_VALID(d.tags_json) THEN d.tags_json ELSE '[]' END) tag
WHERE tag.type = 'text' AND TRIM(tag.value) <> ''
ORDER BY d.created_at, d.id, tag.key;

UPDATE devlog
SET tag_ids_json = (
  SELECT JSON_GROUP_ARRAY(id)
  FROM (
    SELECT DISTINCT 'legacy-tag-' || LOWER(HEX(LOWER(TRIM(tag.value)))) AS id
    FROM JSON_EACH(CASE WHEN JSON_VALID(devlog.tags_json) THEN devlog.tags_json ELSE '[]' END) tag
    WHERE tag.type = 'text' AND TRIM(tag.value) <> ''
  )
);
