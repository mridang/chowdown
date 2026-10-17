-- OAuth 2.1 authorization server for the MCP endpoint (MCP authorization spec).
--
-- oauth_clients: assistants (ChatGPT, Claude, …) that may ask for access. A row
--   is either registered dynamically (kind 'dcr') or cached from a Client ID
--   Metadata Document the client hosts at its client_id URL (kind 'cimd').
-- oauth_grants: one user's approval of one client. Revoking a grant revokes
--   every token issued under it.
-- oauth_codes: single-use authorization codes (hashed), bound to a PKCE
--   challenge, redirect URI and resource.
-- oauth_tokens: access and refresh tokens, stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  client_name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  created_at TEXT NOT NULL,
  fetched_at TEXT
);

CREATE TABLE IF NOT EXISTS oauth_grants (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  resource TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oauth_grants_user ON oauth_grants (user_id);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope TEXT NOT NULL,
  resource TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  grant_id TEXT
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_grant ON oauth_tokens (grant_id);
