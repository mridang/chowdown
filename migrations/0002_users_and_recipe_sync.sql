-- The pivot from a stateless client-side viewer to a public, multi-user,
-- Drive-backed app. Adds the per-user record that server-side OAuth and the
-- per-user MCP endpoint need, and extends `recipes` so each cached recipe is
-- owned by a user and carries the Drive change-detection metadata the sync
-- relies on. Mirrors src/lib/db/schema.ts. Append-only and non-destructive:
-- the app has never been deployed, so there is no production data to preserve,
-- but keeping it additive means local dev databases survive the migration too.

-- One row per signed-in Google account. `google_sub` is Google's stable,
-- opaque user id (the OpenID `sub` claim) and is the real identity key; email
-- can change, `sub` never does. `refresh_token_enc` is the user's Drive OAuth
-- refresh token, encrypted at rest (AES-GCM) with a key held only as a Worker
-- secret — it is what lets the app write to the user's Drive, and later re-read
-- edits, without the user being present. `recipes_folder_id` is the Drive id of
-- the "Recipes" folder chowdown created in the user's Drive and shared with the
-- service account. `mcp_token` is the per-user secret embedded in the user's
-- unique MCP link (`/api/mcp/<mcp_token>`); it is high-entropy and unguessable
-- so the link alone authorizes that user's recipes.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  refresh_token_enc TEXT,
  recipes_folder_id TEXT,
  mcp_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Each cached recipe now belongs to a user. The cache is what makes the recipe
-- list load instantly and lets the headless MCP endpoint answer without a live
-- Drive round-trip; Drive remains the source of truth.
ALTER TABLE recipes ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Drive's `modifiedTime` for the file, used to detect edits during a re-sync:
-- if the folder scan reports a newer time than what we cached, we re-fetch and
-- re-parse that one file. Null until the first sync fills it in.
ALTER TABLE recipes ADD COLUMN modified_time TEXT;

-- When a `.cook` file fails to parse (a corrupted or hand-broken recipe), we
-- store the parser error here and surface the recipe as "couldn't parse" in the
-- UI instead of dropping it or crashing the list. Null means it parsed cleanly.
ALTER TABLE recipes ADD COLUMN parse_error TEXT;

-- The common access pattern is "all recipes for this user", so index it.
CREATE INDEX idx_recipes_user_id ON recipes (user_id);
