-- recipes.embedded_at: when the recipe's embedding was last stored; NULL means
-- it has none. This is a denormalised fact, kept so the /app page and the
-- embeddings top-up can tell which recipes still need an embedding from the
-- recipes they already read, instead of counting (or listing) the embeddings
-- table on every visit (a COUNT visits every entry). It is written in the same
-- batch as the embeddings upsert, and cleared in the same batch that deletes
-- an embedding while its recipe stays (deleteEmbeddingsNotIn); where the recipe
-- row is deleted too (deleteRecipeData, account deletion) it goes with it, and
-- an orphaned embedding has no recipe row to clear.
--
-- Backfill: every recipe that already has a row in embeddings is stamped with
-- the time of the migration; the exact moment is not recorded anywhere.
--
-- idx_recipes_unembedded (user_id, name) WHERE embedded_at IS NULL AND
--   parse_error IS NULL: the recipes that can be embedded but are not yet, in
--   name order. Empty in the steady state, so the top-up reads nothing when
--   everything is embedded. Recipes that fail to parse are left out because
--   they can never be embedded.
ALTER TABLE recipes ADD COLUMN embedded_at TEXT;
UPDATE recipes
SET embedded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM embeddings
  WHERE embeddings.user_id = recipes.user_id
    AND embeddings.drive_file_id = recipes.drive_file_id
);
CREATE INDEX IF NOT EXISTS idx_recipes_unembedded ON recipes (user_id, name)
  WHERE embedded_at IS NULL AND parse_error IS NULL;
