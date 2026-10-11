-- Favourites ("hearts"): one row per (user, recipe) the user has hearted.
-- Keyed by the Drive file id, like the embeddings cache. Kept in D1 rather
-- than Drive so a heart is instant and so popularity can be counted here later.
CREATE TABLE IF NOT EXISTS favourites (
  user_id INTEGER NOT NULL,
  drive_file_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_favourites_user ON favourites (user_id);
