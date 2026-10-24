-- oauth_clients.auth_method / jwks_uri: how a client proves who it is at the
--   token endpoint. 'none' is a public client (PKCE only, the default for every
--   existing row); 'private_key_jwt' (RFC 7523) means each token request must
--   carry an assertion signed with a key published at jwks_uri.
-- oauth_assertions: the jti of every client assertion that has been accepted,
--   kept until the assertion expires, so a captured assertion cannot be used a
--   second time.
ALTER TABLE oauth_clients ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'none';
ALTER TABLE oauth_clients ADD COLUMN jwks_uri TEXT;

CREATE TABLE IF NOT EXISTS oauth_assertions (
  client_id TEXT NOT NULL,
  jti TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (client_id, jti)
);

CREATE INDEX IF NOT EXISTS idx_oauth_assertions_expires ON oauth_assertions (expires_at);
