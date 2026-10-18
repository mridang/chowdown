-- Recipe imports: a user's request to turn pasted links and text into recipe
-- drafts. Kept so the result can be read back (and deleted) as a resource.
-- `items` is a JSON array of { source_url?, title, status, cooklang?, problem? }.
CREATE TABLE IF NOT EXISTS recipe_imports (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  items TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_imports_user ON recipe_imports (user_id, created_at);
