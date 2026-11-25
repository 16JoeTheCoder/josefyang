-- 0006: game hub (game.josefyang.com). One row per game; the hub page copy lives in settings under key 'games_hub'.
CREATE TABLE games (
  id             TEXT PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  draft_json     TEXT NOT NULL,
  published_json TEXT,
  sort           INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL,
  published_at   INTEGER,
  deleted_at     INTEGER
);
CREATE INDEX idx_games_sort ON games(sort);
