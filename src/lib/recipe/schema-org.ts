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

import type { ParsedRecipe } from '@/lib/recipe/cooklang';

/** The subset of schema.org/Recipe we emit. All fields optional but `name`. */
export interface RecipeJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'Recipe';
  readonly name: string;
  readonly recipeIngredient?: readonly string[];
  readonly recipeInstructions?: readonly {
    readonly '@type': 'HowToStep';
    readonly text: string;
  }[];
  readonly recipeCuisine?: string;
  readonly recipeCategory?: string;
  readonly cookingMethod?: string;
  readonly recipeYield?: string;
  readonly cookTime?: string;
  readonly prepTime?: string;
  readonly totalTime?: string;
  readonly keywords?: string;
  readonly suitableForDiet?: readonly string[];
  readonly author?: { readonly '@type': 'Person'; readonly name: string };
  readonly datePublished?: string;
  readonly isBasedOn?: string;
  readonly url?: string;
}

/** Normalise a metadata key: lowercase, strip spaces/underscores/hyphens. */
function normKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '');
}

/** Looks up the first of several metadata keys that has a value. */
type MetaLookup = (keys: readonly string[]) => string | undefined;

/** Build a case-/separator-insensitive lookup over the recipe's metadata. */
function metaLookup(recipe: Readonly<ParsedRecipe>): MetaLookup {
  const map = new Map(
    recipe.metadata
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => [normKey(k), v.trim()] as const),
  );
  // The first key (in the order asked for) that has a non-empty value wins.
  return (keys) => keys.map((k) => map.get(normKey(k))).find(Boolean);
}

/**
 * Turn a human duration ("30 minutes", "1 hr 15 min", "2 hours") into an
 * ISO-8601 duration (`PT30M`, `PT1H15M`, `PT2H`). Returns `undefined` when the
 * string carries no recognisable hours/minutes.
 */
export function toIsoDuration(value: string): string | undefined {
  const hours = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(value);
  const mins = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i.exec(value);
  // A bare number with no unit is read as minutes ("prep: 20").
  const bare = hours || mins ? null : /^\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!hours && !mins && !bare) {
    return undefined;
  }
  const rawHours = hours ? Number(hours[1]) : 0;
  const rawMinutes = Number((bare ?? mins)?.[1] ?? 0);
  // Fold fractional hours into minutes so "1.5 hours" → PT1H30M.
  const h = Math.floor(rawHours);
  const m = Number.isInteger(rawHours)
    ? rawMinutes
    : rawMinutes + Math.round((rawHours - h) * 60);
  if (h === 0 && m === 0) {
    return undefined;
  }
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${Math.round(m)}M` : ''}`;
}

/** Split a comma/semicolon-separated metadata value into trimmed parts. */
function splitList(value: string): readonly string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The ISO duration of whichever of `keys` the recipe has, if it reads as one. */
function durationOf(
  get: MetaLookup,
  keys: readonly string[],
): string | undefined {
  const value = get(keys);
  return value ? toIsoDuration(value) : undefined;
}

/**
 * Project a parsed recipe onto schema.org/Recipe JSON-LD.
 *
 * @param recipe - The parsed Cooklang recipe.
 * @param url - The canonical URL of this recipe's page (for `url`).
 */
export function recipeToJsonLd(
  recipe: Readonly<ParsedRecipe>,
  url?: string,
): RecipeJsonLd {
  const get = metaLookup(recipe);
  const cuisine = get(['cuisine', 'recipeCuisine']);
  const category = get(['category', 'course', 'recipeCategory']);
  const method = get(['method', 'cookingMethod']);
  const servings = get(['servings', 'serves', 'yield', 'recipeYield']);
  const cookTime = durationOf(get, ['cook time', 'cooktime', 'cook']);
  const prepTime = durationOf(get, ['prep time', 'preptime', 'prep']);
  const totalTime = durationOf(get, [
    'total time',
    'totaltime',
    'time',
    'duration',
  ]);
  const keywords = get(['tags', 'keywords']);
  const diet = get(['diet', 'suitableForDiet']);
  const author = get(['author', 'by']);
  const published = get([
    'date published',
    'datepublished',
    'published',
    'date',
  ]);
  const source = get(['source', 'source url', 'sourceurl', 'url', 'original']);

  // Every field below is left out entirely when the recipe doesn't have it.
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    ...(recipe.ingredients.length > 0
      ? {
          recipeIngredient: recipe.ingredients.map((i) =>
            i.quantity ? `${i.quantity} ${i.name}`.trim() : i.name,
          ),
        }
      : {}),
    ...(recipe.steps.length > 0
      ? {
          recipeInstructions: recipe.steps.map((step) => ({
            '@type': 'HowToStep' as const,
            text: step
              .map((t) => {
                if (t.kind === 'text') return t.text;
                if (t.kind === 'timer') return t.label;
                return t.name;
              })
              .join('')
              .trim(),
          })),
        }
      : {}),
    ...(cuisine ? { recipeCuisine: cuisine } : {}),
    ...(category ? { recipeCategory: category } : {}),
    ...(method ? { cookingMethod: method } : {}),
    ...(servings ? { recipeYield: servings } : {}),
    ...(cookTime ? { cookTime } : {}),
    ...(prepTime ? { prepTime } : {}),
    ...(totalTime ? { totalTime } : {}),
    ...(keywords ? { keywords: splitList(keywords).join(', ') } : {}),
    ...(diet ? { suitableForDiet: splitList(diet) } : {}),
    ...(author ? { author: { '@type': 'Person' as const, name: author } } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(source ? { isBasedOn: source } : {}),
    ...(url ? { url } : {}),
  };
}
