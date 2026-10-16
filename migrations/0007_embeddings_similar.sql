-- Precomputed "find similar" list per recipe: a JSON array of {id, title} for the
-- closest other recipes. Computed whenever embeddings change, so the recipe page
-- reads one small value instead of loading every vector on each view.
ALTER TABLE embeddings ADD COLUMN similar TEXT;
