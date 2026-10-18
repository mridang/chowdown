/**
 * @packageDocumentation
 *
 * Map a parsed Cooklang recipe onto a schema.org/Recipe JSON-LD object, so the
 * `/recipe/[id]` page can emit structured data that Google, Pinterest and the
 * rest understand (rich results, "save recipe", etc.).
 *
 * Cooklang metadata is free-form `>> key: value` lines, so this is a
 * best-effort projection: we look up the handful of keys that map cleanly onto
 * schema.org and leave the rest out rather than inventing structure. Duration
 * strings like "30 minutes" or "1 hr 15 min" are normalised to ISO-8601
 * durations (`PT30M`), which is what schema.org expects for `cookTime` &co.
 */

import type { ParsedRecipe } from './cooklang';

/** The subset of schema.org/Recipe we emit. All fields optional but `name`. */
export interface RecipeJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Recipe';
  name: string;
  recipeIngredient?: string[];
  recipeInstructions?: { '@type': 'HowToStep'; text: string }[];
  recipeCuisine?: string;
  recipeCategory?: string;
  cookingMethod?: string;
  recipeYield?: string;
  cookTime?: string;
  prepTime?: string;
  totalTime?: string;
  keywords?: string;
  suitableForDiet?: string[];
  author?: { '@type': 'Person'; name: string };
  datePublished?: string;
  isBasedOn?: string;
  url?: string;
}

/** Normalise a metadata key: lowercase, strip spaces/underscores/hyphens. */
function normKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '');
}

/** Build a case-/separator-insensitive lookup over the recipe's metadata. */
function metaLookup(
  recipe: ParsedRecipe,
): (keys: string[]) => string | undefined {
  const map = new Map<string, string>();
  for (const [k, v] of recipe.metadata) {
    if (v && v.trim()) {
      map.set(normKey(k), v.trim());
    }
  }
  return (keys) => {
    for (const k of keys) {
      const hit = map.get(normKey(k));
      if (hit) {
        return hit;
      }
    }
    return undefined;
  };
}

/**
 * Turn a human duration ("30 minutes", "1 hr 15 min", "2 hours") into an
 * ISO-8601 duration (`PT30M`, `PT1H15M`, `PT2H`). Returns `undefined` when the
 * string carries no recognisable hours/minutes.
 */
export function toIsoDuration(value: string): string | undefined {
  const hours = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(value);
  const mins = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i.exec(value);
  let h = hours ? Number(hours[1]) : 0;
  let m = mins ? Number(mins[1]) : 0;
  // A bare number with no unit is read as minutes ("prep: 20").
  if (!hours && !mins) {
    const bare = /^\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
    if (!bare) {
      return undefined;
    }
    m = Number(bare[1]);
  }
  // Fold fractional hours into minutes so "1.5 hours" → PT1H30M.
  if (!Number.isInteger(h)) {
    m += Math.round((h - Math.floor(h)) * 60);
    h = Math.floor(h);
  }
  if (h === 0 && m === 0) {
    return undefined;
  }
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${Math.round(m)}M` : ''}`;
}

/** Split a comma/semicolon-separated metadata value into trimmed parts. */
function splitList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Project a parsed recipe onto schema.org/Recipe JSON-LD.
 *
 * @param recipe - The parsed Cooklang recipe.
 * @param url - The canonical URL of this recipe's page (for `url`).
 */
export function recipeToJsonLd(
  recipe: ParsedRecipe,
  url?: string,
): RecipeJsonLd {
  const get = metaLookup(recipe);

  const ld: RecipeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
  };

  if (recipe.ingredients.length > 0) {
    ld.recipeIngredient = recipe.ingredients.map((i) =>
      i.quantity ? `${i.quantity} ${i.name}`.trim() : i.name,
    );
  }

  if (recipe.steps.length > 0) {
    ld.recipeInstructions = recipe.steps.map((step) => ({
      '@type': 'HowToStep',
      text: step
        .map((t) => {
          if (t.kind === 'text') return t.text;
          if (t.kind === 'timer') return t.label;
          return t.name;
        })
        .join('')
        .trim(),
    }));
  }

  const cuisine = get(['cuisine', 'recipeCuisine']);
  if (cuisine) ld.recipeCuisine = cuisine;

  const category = get(['category', 'course', 'recipeCategory']);
  if (category) ld.recipeCategory = category;

  const method = get(['method', 'cookingMethod']);
  if (method) ld.cookingMethod = method;

  const servings = get(['servings', 'serves', 'yield', 'recipeYield']);
  if (servings) ld.recipeYield = servings;

  const cook = get(['cook time', 'cooktime', 'cook']);
  if (cook) {
    const iso = toIsoDuration(cook);
    if (iso) ld.cookTime = iso;
  }

  const prep = get(['prep time', 'preptime', 'prep']);
  if (prep) {
    const iso = toIsoDuration(prep);
    if (iso) ld.prepTime = iso;
  }

  const total = get(['total time', 'totaltime', 'time', 'duration']);
  if (total) {
    const iso = toIsoDuration(total);
    if (iso) ld.totalTime = iso;
  }

  const keywords = get(['tags', 'keywords']);
  if (keywords) ld.keywords = splitList(keywords).join(', ');

  const diet = get(['diet', 'suitableForDiet']);
  if (diet) ld.suitableForDiet = splitList(diet);

  const author = get(['author', 'by']);
  if (author) ld.author = { '@type': 'Person', name: author };

  const published = get([
    'date published',
    'datepublished',
    'published',
    'date',
  ]);
  if (published) ld.datePublished = published;

  const source = get(['source', 'source url', 'sourceurl', 'url', 'original']);
  if (source) ld.isBasedOn = source;

  if (url) ld.url = url;

  return ld;
}
