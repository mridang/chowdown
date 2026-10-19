-- oauth_codes.redirect_uri_sent: whether the authorization request carried a
--   redirect_uri, or the client's only registered address was assumed. OAuth 2.1
--   §4.1.3 requires the parameter at the token endpoint only when it was sent
--   in the authorization request, so a client that left it out of both
--   requests must not be refused. Codes live two minutes; any row that exists
--   when this runs is treated as "sent" (the old, stricter behaviour).
ALTER TABLE oauth_codes ADD COLUMN redirect_uri_sent INTEGER NOT NULL DEFAULT 1;
