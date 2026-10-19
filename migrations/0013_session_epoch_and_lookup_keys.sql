-- Revocable sessions, a tenant-safe recipe key, and indexed lookups.
-- Mirrors src/lib/db/schema.ts. Everything here is additive (new nullable or
-- defaulted columns, new indexes) so the previous release keeps working against
-- the new schema in the gap between applying this and deploying the code.
--
-- users.session_epoch: the session cookie carries the epoch it was issued under
--   and is only honoured while it equals this column. Bumping it (sign out
--   everywhere) ends every session at once without a session table. Cookies
--   issued before the claim existed count as epoch 0, which is what every
--   existing row gets, so nobody is signed out by this migration.
--
-- idx_recipes_user_file: a recipe is identified by (user, Drive file), not by
--   the Drive file id alone. The old UNIQUE(drive_file_id) stays, because the
--   previous release upserts on it; with both in place a second user's attempt
--   to cache a file id the first user already holds fails loudly instead of
--   overwriting the first user's text. The global constraint can be dropped
--   once no release upserts on it.
--
-- recipes.source_url: the normalised `>> source:` address, so "have I imported
--   this link" is an index lookup instead of reading every recipe. NULL means
--   "not worked out yet" (rows cached before this column, or written by the
--   previous release); the empty string means "worked out, there is none".
--
-- recipe_imports.item_count: how many drafts an import holds, so listing
--   imports does not read every draft. NULL means "count the items".
ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_user_file
  ON recipes (user_id, drive_file_id);

ALTER TABLE recipes ADD COLUMN source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_user_source_url
  ON recipes (user_id, source_url);

ALTER TABLE recipe_imports ADD COLUMN item_count INTEGER;

UPDATE recipe_imports
SET item_count = CASE WHEN json_valid(items) THEN json_array_length(items) ELSE 0 END;

-- The retention sweep deletes old imports across all users by age.
CREATE INDEX IF NOT EXISTS idx_recipe_imports_created
  ON recipe_imports (created_at);
