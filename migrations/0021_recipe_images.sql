-- recipe_images: one row per photo address a recipe lists in `>> images:`, so
-- "may this person fetch this photo?" (the image proxy, on every cover) is an
-- index lookup instead of a text search through every recipe's full source.
-- It is a normalised copy of what is inside recipes.source, written in the same
-- D1 batch as the recipe (upsertRecipe replaces the recipe's rows) and removed
-- in the same batch that deletes the recipe (deleteRecipesNotIn,
-- deleteRecipeData, account deletion).
--
-- The primary key (user_id, drive_file_id, url) serves "replace this recipe's
-- rows"; idx_recipe_images_url (user_id, url) serves the ownership lookup and
-- covers it, so the lookup never touches the table.
--
-- recipes.images_indexed: 1 once the recipe's rows are in recipe_images.
--
-- Backfill: not possible in SQL. The addresses come out of the parsed
-- Cooklang metadata (whitespace split, http(s) validation, keeping the biggest
-- rendition of each photo), which SQL cannot reproduce faithfully. So every
-- existing recipe starts at images_indexed = 0 and is filled in lazily: on its
-- next write, or the first time its owner asks for a photo that is not found
-- in the table (userHasCover indexes that person's unindexed recipes in one
-- go). Until then the lookup still reads those recipes' text, so it is never
-- wrong, only slower for recipes not yet indexed.
--
-- idx_recipes_images_unindexed (user_id) WHERE images_indexed = 0: the recipes
-- still to be indexed. Empty in the steady state, so finding them reads nothing.
ALTER TABLE recipes ADD COLUMN images_indexed INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS recipe_images (
  user_id INTEGER NOT NULL,
  drive_file_id TEXT NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (user_id, drive_file_id, url)
);
CREATE INDEX IF NOT EXISTS idx_recipe_images_url ON recipe_images (user_id, url);
CREATE INDEX IF NOT EXISTS idx_recipes_images_unindexed ON recipes (user_id)
  WHERE images_indexed = 0;
