-- Recipes opened through the app, cached by their Drive file id. The viewer
-- is client-side and works without this table; it exists for future history
-- and sharing features. Mirrors src/lib/db/schema.ts.
CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_file_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT,
  source TEXT NOT NULL,
  first_opened_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL
);
