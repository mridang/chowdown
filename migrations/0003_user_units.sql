-- Remember each user's preferred measurement system so recipes can be shown in
-- it. Null means "show the recipe as written" (no conversion). Values: 'metric',
-- 'us', 'imperial'. Mirrors src/lib/db/schema.ts.
ALTER TABLE users ADD COLUMN units TEXT;
