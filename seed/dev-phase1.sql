-- LOCAL ONLY (Phase 1 route/visitor fixture). Bracketed fixture content, never real work. Idempotent.
-- Run: npx wrangler d1 execute josefyang-db --local --file=seed/dev-phase1.sql
INSERT OR REPLACE INTO games (id, slug, draft_json, published_json, sort, updated_at, published_at) VALUES
 ('g-fixture', 'modulus', '{"slug":"modulus","game":{"name":{"value":"[Fixture game]"},"tagline":{"value":"[Fixture tagline]"}}}',
  '{"slug":"modulus","game":{"name":{"value":"[Fixture game]"},"tagline":{"value":"[Fixture tagline]"}}}', 0, 1, 1);
-- Eligible for the journey: published, due, main + games, tied to a game.
INSERT OR REPLACE INTO devlog (id, slug, title, excerpt, body, status, created_at, published_at, entry_date, updated_at, sites_json, game_slug, type)
 VALUES ('p1-game-main', 'fixture-game-update', '[Fixture game update, main and games]', '[Shown on /games and /devlog.]', '[Body.]', 'published', 1, 1, '2026-11-20', 1, '["main","games"]', 'modulus', 'note');
-- Game-only: excluded from the main journey in Phase 1.
INSERT OR REPLACE INTO devlog (id, slug, title, excerpt, body, status, created_at, published_at, entry_date, updated_at, sites_json, game_slug, type)
 VALUES ('p1-game-only', 'fixture-game-only', '[Fixture game-only entry]', '[Must not appear on main.]', '[Body.]', 'published', 1, 1, '2026-11-21', 1, '["games"]', 'modulus', 'note');
-- Scheduled in the future: excluded until due.
INSERT OR REPLACE INTO devlog (id, slug, title, excerpt, body, status, created_at, published_at, entry_date, updated_at, sites_json, game_slug, type, publish_at)
 VALUES ('p1-game-scheduled', 'fixture-game-scheduled', '[Fixture scheduled game update]', '[Not yet due.]', '[Body.]', 'published', 1, 1, '2026-11-22', 1, '["main","games"]', 'modulus', 'note', '2099-01-01T00:00:00Z');
-- A very long title for wrapping checks at 390 px.
INSERT OR REPLACE INTO devlog (id, slug, title, excerpt, body, status, created_at, published_at, entry_date, updated_at, sites_json, game_slug, type)
 VALUES ('p1-game-long', 'fixture-game-long-title', '[Fixture update with an unusually long title that keeps going to test wrapping on a narrow phone screen]', '[Long title check.]', '[Body.]', 'published', 1, 1, '2026-11-19', 1, '["main"]', 'modulus', 'note');
