-- Cache the curated taxonomy tags for each recipe in the recipes read-cache,
-- so the app's faceted list can filter and count server-side without reading
-- every .cook file from Drive on each page load. Stored as a JSON object of
-- facet -> array of values (e.g. {"protein":["chicken"],"cuisine":["Indian"]}).
ALTER TABLE recipes ADD COLUMN tags TEXT;
