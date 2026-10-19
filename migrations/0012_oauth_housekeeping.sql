-- Housekeeping for the OAuth tables.
--
-- oauth_clients.expires_at: until when a fetched Client ID Metadata Document may
--   be reused, taken from the client's cache headers (bounded to 5 minutes..1
--   day). NULL for rows cached before this column existed and for registered
--   clients; such rows fall back to a one-hour lifetime from `fetched_at`.
--
-- The indexes serve the background sweep that deletes expired codes and tokens
-- and revoked grants (`purgeOAuthData`), the "one connection per user and
-- client" replacement made when an app is approved again, and the client
-- registry's "has this client any grant" checks.
ALTER TABLE oauth_clients ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_oauth_grants_user_client
  ON oauth_grants (user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_client
  ON oauth_grants (client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires
  ON oauth_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires
  ON oauth_codes (expires_at);
