-- Per-recipe embedding cache, powering semantic search (find_recipes), the
-- "find similar" row, and the app's "what to eat?" box. Keyed by the Drive file
-- id and stamped with the file's modifiedTime so we only re-embed on change.
-- `vector` is the embedding as a JSON array of floats (Workers AI bge-base-en,
-- 768 dims). Mirrors src/lib/db/schema.ts.
CREATE TABLE embeddings (
  user_id INTEGER NOT NULL,
  drive_file_id TEXT NOT NULL,
  title TEXT NOT NULL,
  modified_time TEXT,
  vector TEXT NOT NULL,
  PRIMARY KEY (user_id, drive_file_id)
);

CREATE INDEX idx_embeddings_user ON embeddings (user_id);
