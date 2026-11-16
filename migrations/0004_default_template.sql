-- 0004: the default build-page template (architecture §12.6). Builds pin (id, version).
INSERT INTO templates (id, version, name, sections_json, created_at) VALUES (
  'build-default', 1, 'Build page',
  '[{"moduleId":"build-header","moduleVersion":1,"defaults":{}},{"moduleId":"build-hero-image","moduleVersion":1,"defaults":{}},{"moduleId":"build-rows","moduleVersion":1,"defaults":{}},{"moduleId":"build-end","moduleVersion":1,"defaults":{}}]',
  1763251200000
);
