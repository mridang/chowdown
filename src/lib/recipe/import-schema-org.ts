/**
 * @packageDocumentation
 *
 * Best-effort conversion of schema.org `Recipe` structured data into Cooklang.
 * Almost every recipe site on the web embeds a `Recipe` JSON-LD block (it is
 * what powers Google's recipe cards), so this is the most reliable import path:
 * share a recipe URL to chowdown, we fetch the page, pull the JSON-LD, and turn
 * it into a `.cook` file. The same converter handles recipes pasted or dumped
 * from elsewhere (e.g. a Notion export routed through ChatGPT's `add_recipe`
 * tool) once they are shaped as schema.org objects.
 *
 * The conversion is intentionally lossy and honest about it: schema.org gives
 * us free-text ingredient strings ("200 g flour") and free-text instructions,
 * not Cooklang's structured tokens, so we parse a leading quantity/unit off
 * each ingredient and emit `@name{qty%unit}` on a best-effort basis. The
 * result is a valid, editable `.cook` the user curates — not a perfect
 * reconstruction. The fetch/HTML side lives in the caller; everything here is
 * pure and unit-tested.
 */

/** A loose JSON value — JSON-LD arrives without a fixed shape. */
type Json = unknown;

/** A parsed ingredient: an optional quantity and unit plus the ingredient name. */
export interface ParsedIngredientLine {
  quantity?: string;
  unit?: string;
  name: string;
}

/** Units we recognise as the token right after a leading quantity. */
const KNOWN_UNITS = new Set([
  'g',
  'kg',
  'mg',
  'ml',
  'l',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'oz',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'clove',
  'cloves',
  'pinch',
  'slice',
  'slices',
  'can',
  'cans',
  'stick',
  'sticks',
  'piece',
  'pieces',
]);

/** Leading-quantity matcher: integers, decimals, simple fractions and ranges. */
const LEADING_QUANTITY = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*-\s*\d+)?|[½¼¾⅓⅔⅛])\s+/;

/**
 * Parse one schema.org ingredient string into a quantity/unit/name. Falls back
 * gracefully: with no recognisable number the whole string becomes the name
 * ("salt to taste"); with a number but no known unit the number is the
 * quantity ("2 eggs" -> qty 2, name "eggs").
 */
export function parseIngredientLine(raw: string): ParsedIngredientLine {
  const text = raw.replace(/\s+/g, ' ').trim();
  const quantityMatch = LEADING_QUANTITY.exec(text);
  if (!quantityMatch) {
    return { name: text };
  }
  const quantity = quantityMatch[1]!.replace(/\s+/g, '');
  let rest = text.slice(quantityMatch[0].length).trim();

  const [maybeUnit, ...tail] = rest.split(' ');
  if (maybeUnit && KNOWN_UNITS.has(maybeUnit.toLowerCase()) && tail.length) {
    return { quantity, unit: maybeUnit, name: tail.join(' ') };
  }
  return { quantity, name: rest };
}

/** Render a parsed ingredient as a Cooklang token: `@name{qty%unit}`. */
export function toCookIngredient(ing: ParsedIngredientLine): string {
  const amount =
    ing.quantity && ing.unit
      ? `${ing.quantity}%${ing.unit}`
      : (ing.quantity ?? '');
  return `@${ing.name}{${amount}}`;
}

/** Convert an ISO-8601 duration (`PT1H30M`) into a human string (`1 hr 30 min`). */
export function humaniseDuration(iso: string): string | undefined {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  if (!match || (!match[1] && !match[2])) {
    return undefined;
  }
  const parts: string[] = [];
  if (match[1]) {
    parts.push(`${match[1]} hr`);
  }
  if (match[2]) {
    parts.push(`${match[2]} min`);
  }
  return parts.join(' ');
}

/** True if a JSON-LD node's `@type` is (or includes) `Recipe`. */
function isRecipeNode(node: Json): node is Record<string, Json> {
  if (typeof node !== 'object' || node === null) {
    return false;
  }
  const type = (node as Record<string, Json>)['@type'];
  return Array.isArray(type) ? type.includes('Recipe') : type === 'Recipe';
}

/**
 * Find the first `Recipe` node anywhere in a parsed JSON-LD value — handling a
 * bare object, an array of nodes, or a `@graph` wrapper (all three occur in
 * the wild).
 */
export function findRecipeNode(input: Json): Record<string, Json> | null {
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findRecipeNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof input === 'object' && input !== null) {
    if (isRecipeNode(input)) {
      return input;
    }
    const graph = (input as Record<string, Json>)['@graph'];
    if (graph) {
      return findRecipeNode(graph);
    }
  }
  return null;
}

/** Coerce schema.org's many instruction shapes into a flat list of step texts. */
function normaliseInstructions(value: Json): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') {
        return [item.trim()];
      }
      if (typeof item === 'object' && item !== null) {
        const node = item as Record<string, Json>;
        // HowToSection wraps further steps in itemListElement.
        if (node['itemListElement']) {
          return normaliseInstructions(node['itemListElement']);
        }
        const text = node['text'] ?? node['name'];
        if (typeof text === 'string') {
          return [text.trim()];
        }
      }
      return [];
    });
  }
  return [];
}

/** Coerce a scalar-or-array string field to a single trimmed string. */
function firstString(value: Json): string | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return undefined;
}

/** Author display name from schema.org `author` (string, object, or array). */
function authorName(value: Json): string | undefined {
  const node = Array.isArray(value) ? value[0] : value;
  if (typeof node === 'string') {
    return node.trim();
  }
  if (typeof node === 'object' && node !== null) {
    const name = (node as Record<string, Json>)['name'];
    if (typeof name === 'string') {
      return name.trim();
    }
  }
  return undefined;
}

/** Image URLs from schema.org `image` (string, ImageObject, or arrays thereof). */
export function imageUrls(value: Json): string[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const urls: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      urls.push(item.trim());
    } else if (typeof item === 'object' && item !== null) {
      const node = item as Record<string, Json>;
      const url = node['url'] ?? node['contentUrl'];
      if (typeof url === 'string') {
        urls.push(url.trim());
      }
    }
  }
  return urls;
}

/** Video URL from schema.org `video` (VideoObject contentUrl/embedUrl/url). */
function videoUrl(value: Json): string | undefined {
  const node = Array.isArray(value) ? value[0] : value;
  if (typeof node === 'string') {
    return node.trim();
  }
  if (typeof node === 'object' && node !== null) {
    const v = node as Record<string, Json>;
    const url = v['contentUrl'] ?? v['embedUrl'] ?? v['url'];
    if (typeof url === 'string') {
      return url.trim();
    }
  }
  return undefined;
}

/** Join `suitableForDiet` values, stripping the schema.org URL/`Diet` decorations. */
export function dietNames(value: Json): string | undefined {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const names = items
    .filter((i): i is string => typeof i === 'string')
    .map((s) =>
      s
        .replace(/^https?:\/\/schema\.org\//, '')
        .replace(/Diet$/, '')
        .trim(),
    )
    .filter(Boolean);
  return names.length ? names.join(', ') : undefined;
}

/**
 * Convert a schema.org `Recipe` node into Cooklang source. Ingredients are
 * emitted as a leading block of `@name{qty%unit}` tokens (so the parser and
 * the ingredients panel pick them up), followed by one step per instruction.
 * Known metadata (servings, time, source, tags) is written as `>>` lines.
 *
 * @param recipe - A node already confirmed to be a `Recipe`.
 * @param sourceUrl - The page it came from, recorded as `>> source:`.
 */
export function schemaOrgToCook(
  recipe: Record<string, Json>,
  sourceUrl?: string,
): string {
  const title = firstString(recipe['name']) ?? 'Imported Recipe';
  const meta: string[] = [`>> title: ${title}`];
  const add = (key: string, value: string | undefined): void => {
    if (value) {
      meta.push(`>> ${key}: ${value}`);
    }
  };

  const servings = recipe['recipeYield'];
  add('servings', typeof servings === 'number' ? String(servings) : firstString(servings));

  // Times (prep + total/cook). The LLM tagging pass later adds the Quick/Med/Long bucket.
  const prep = firstString(recipe['prepTime']);
  add('prep', prep ? humaniseDuration(prep) : undefined);
  const total = firstString(recipe['totalTime']) ?? firstString(recipe['cookTime']);
  add('time', total ? humaniseDuration(total) : undefined);

  // Taxonomy that schema.org carries directly (protein/difficulty/equipment come
  // from the model pass since schema.org has no such fields).
  add('cuisine', firstString(recipe['recipeCuisine']));
  add('category', firstString(recipe['recipeCategory']));
  add('diet', dietNames(recipe['suitableForDiet']));
  add('method', firstString(recipe['cookingMethod']));
  add('keywords', firstString(recipe['keywords']));

  // Provenance — preserve where the recipe came from.
  add('author', authorName(recipe['author']));
  add('published', firstString(recipe['datePublished']));
  add('source', sourceUrl ?? firstString(recipe['url']));

  // Media references (may be mirrored to R2/Images/Stream for permanence later).
  // Space-separated: image URLs can contain commas (e.g. `?resize=440,400`) but
  // never spaces, so whitespace is a safe delimiter (see media.ts).
  const images = imageUrls(recipe['image']);
  if (images.length) {
    add('images', images.join(' '));
  }
  add('video', videoUrl(recipe['video']));

  const rawIngredients = recipe['recipeIngredient'] ?? recipe['ingredients'];
  const ingredientLines = Array.isArray(rawIngredients)
    ? rawIngredients
        .filter((i): i is string => typeof i === 'string')
        .map((i) => toCookIngredient(parseIngredientLine(i)))
    : [];

  const steps = normaliseInstructions(recipe['recipeInstructions']);

  const blocks: string[] = [meta.join('\n')];
  if (ingredientLines.length) {
    // One paragraph of ingredient tokens → a single "gather" step the parser
    // reads for the ingredients panel. The user curates it into the method.
    blocks.push(ingredientLines.join('\n'));
  }
  for (const step of steps) {
    blocks.push(step);
  }
  return `${blocks.join('\n\n')}\n`;
}

/**
 * Pull `Recipe` JSON-LD out of a page's HTML and convert it. Returns null when
 * the page has no parseable recipe. Kept regex-based (no DOM) so it runs in the
 * Worker; malformed JSON-LD blocks are skipped rather than throwing.
 */
export function extractRecipeFromHtml(
  html: string,
  sourceUrl?: string,
): string | null {
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    let parsed: Json;
    try {
      parsed = JSON.parse(match[1]!.trim());
    } catch {
      continue;
    }
    const node = findRecipeNode(parsed);
    if (node) {
      return schemaOrgToCook(node, sourceUrl);
    }
  }
  return null;
}
