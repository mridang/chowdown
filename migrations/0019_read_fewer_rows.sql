-- Indexes that let the hot reads stop sorting or scanning, and drop the ones
-- the others make redundant. Additive apart from the drops, which only remove
-- an index whose work another index already does.
--
-- recipes (user_id, name): the /app grid and every "all recipes for this user"
--   read (listRecipesByUser, getAppPageRows, the sync's stale-recipe check)
--   come back ordered by name straight from the index, with no temporary sort.
--   It leads with user_id, so it replaces idx_recipes_user_id.
--
-- recipes (user_id, source_url, name): "have I imported this link" and the
--   legacy-row backfill both match on user and source_url; the trailing name
--   keeps the first match in name order without a sort. It replaces
--   idx_recipes_user_source_url.
--
-- Redundant once the primary keys are in place: idx_embeddings_user and
--   idx_favourites_user (the (user_id, drive_file_id) primary key leads with
--   user_id) and idx_oauth_grants_user (idx_oauth_grants_user_client leads with
--   user_id).
--
-- oauth_grants (revoked_at, coalesce(last_used_at, created_at)): the background
--   OAuth sweep finds grants that were revoked before a cutoff, and active grants
--   idle since one. One index serves both as a range on revoked_at (and the
--   idle test as a range inside each revoked_at value), where the table used to
--   be scanned in full.
--
-- oauth_clients (kind, created_at) and (kind, fetched_at): the sweep that removes
--   unused registered and fetched clients finds them by kind and age instead of
--   scanning every client.
CREATE INDEX IF NOT EXISTS idx_recipes_user_name ON recipes (user_id, name);
CREATE INDEX IF NOT EXISTS idx_recipes_user_source_url_name ON recipes (user_id, source_url, name);
DROP INDEX IF EXISTS idx_recipes_user_id;
DROP INDEX IF EXISTS idx_recipes_user_source_url;
DROP INDEX IF EXISTS idx_embeddings_user;
DROP INDEX IF EXISTS idx_favourites_user;
DROP INDEX IF EXISTS idx_oauth_grants_user;
CREATE INDEX IF NOT EXISTS idx_oauth_grants_revoked_used ON oauth_grants (revoked_at, coalesce(last_used_at, created_at));
CREATE INDEX IF NOT EXISTS idx_oauth_clients_kind_created ON oauth_clients (kind, created_at);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_kind_fetched ON oauth_clients (kind, fetched_at);
