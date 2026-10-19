-- Throttling for the work a page view used to start on every load.
-- Mirrors src/lib/db/schema.ts. Nullable additions, safe beside the previous
-- release.
--
-- users.last_synced_at: when a Drive sync for the person was last started. A
--   view starts one only if the last start is over a minute old, so a refresh
--   loop or two open tabs cost one sync, not one each. The claim is a single
--   conditional UPDATE, so exactly one of several simultaneous views wins.
--
-- users.backfill_lease_until: until when one request owns the job of embedding
--   the person's missing recipes. A second request that finds the lease still
--   running leaves the job alone instead of paying for the same embeddings
--   twice.
ALTER TABLE users ADD COLUMN last_synced_at TEXT;
ALTER TABLE users ADD COLUMN backfill_lease_until TEXT;
