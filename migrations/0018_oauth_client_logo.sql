-- oauth_clients.logo_uri: the picture a client publishes for itself (the
--   `logo_uri` of its metadata document), shown beside the app in the list of
--   connected apps. Only a client that publishes a document has one; NULL for
--   registered clients and for rows cached before this column existed.
ALTER TABLE oauth_clients ADD COLUMN logo_uri TEXT;
