-- Remove the per-user secret MCP link. The link (`/api/mcp/<mcp_token>`) is gone;
-- assistants connect through the OAuth-protected `/api/mcp`, which puts no
-- secret in the address and can be disconnected. Nothing reads `mcp_token` any
-- more, and it was `NOT NULL UNIQUE`, so new rows could not be written without
-- it. SQLite cannot drop a UNIQUE column in place, so the table is rebuilt.
--
-- `recipes.user_id` references `users(id)`, so foreign-key checks are deferred
-- to the end of the migration. They balance only if the new `users` rows are
-- inserted AFTER the old table is dropped (each insert answers one dropped
-- row), which is why the data waits in a scratch table meanwhile.
PRAGMA defer_foreign_keys = on;

CREATE TABLE users_scratch AS SELECT * FROM users;
CREATE TABLE users_seq_scratch AS
  SELECT seq FROM sqlite_sequence WHERE name = 'users';

DROP TABLE users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  refresh_token_enc TEXT,
  recipes_folder_id TEXT,
  units TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO users (
  id, google_sub, email, name, picture, refresh_token_enc, recipes_folder_id,
  units, created_at, updated_at
)
SELECT
  id, google_sub, email, name, picture, refresh_token_enc, recipes_folder_id,
  units, created_at, updated_at
FROM users_scratch;

-- Keep the id counter where it was, so an id is never handed out twice.
UPDATE sqlite_sequence
SET seq = (SELECT seq FROM users_seq_scratch)
WHERE name = 'users'
  AND EXISTS (SELECT 1 FROM users_seq_scratch)
  AND (SELECT seq FROM users_seq_scratch) > seq;

DROP TABLE users_scratch;
DROP TABLE users_seq_scratch;
