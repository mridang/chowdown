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

import { validImageUrls } from './media';

/** A loose JSON value — JSON-LD arrives without a fixed shape. */
type Json = unknown;

/** A JSON object whose members are not yet known to be anything in particular. */
type JsonObject = Readonly<Record<string, Json>>;

/** A parsed ingredient: an optional quantity and unit plus the ingredient name. */
export interface ParsedIngredientLine {
  readonly quantity?: string;
  readonly unit?: string;
  readonly name: string;
}

/** Units we recognise as the token right after a leading quantity. */
const KNOWN_UNITS: ReadonlySet<string> = new Set([
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
const LEADING_QUANTITY =
  /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*-\s*\d+)?|[½¼¾⅓⅔⅛])\s+/;

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
  const quantity = (quantityMatch[1] ?? '').replace(/\s+/g, '');
  const rest = text.slice(quantityMatch[0].length).trim();

  const [maybeUnit, ...tail] = rest.split(' ');
  if (maybeUnit && KNOWN_UNITS.has(maybeUnit.toLowerCase()) && tail.length) {
    return { quantity, unit: maybeUnit, name: tail.join(' ') };
  }
  return { quantity, name: rest };
}

/** Render a parsed ingredient as a Cooklang token: `@name{qty%unit}`. */
export function toCookIngredient(ing: Readonly<ParsedIngredientLine>): string {
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
  return [match[1] ? `${match[1]} hr` : '', match[2] ? `${match[2]} min` : '']
    .filter(Boolean)
    .join(' ');
}

/** Whether a parsed JSON value is an object (arrays count: they are objects too). */
function isObject(value: Json): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

/** True if a JSON-LD node's `@type` is (or includes) `Recipe`. */
function isRecipeNode(node: Json): node is JsonObject {
  if (!isObject(node)) {
    return false;
  }
  const type = node['@type'];
  return Array.isArray(type) ? type.includes('Recipe') : type === 'Recipe';
}

/**
 * Find the first `Recipe` node anywhere in a parsed JSON-LD value — handling a
 * bare object, an array of nodes, or a `@graph` wrapper (all three occur in
 * the wild).
 */
export function findRecipeNode(input: Json): JsonObject | null {
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findRecipeNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (isObject(input)) {
    if (isRecipeNode(input)) {
      return input;
    }
    const graph = input['@graph'];
    if (graph) {
      return findRecipeNode(graph);
    }
  }
  return null;
}

/** Coerce schema.org's many instruction shapes into a flat list of step texts. */
function normaliseInstructions(value: Json): readonly string[] {
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
      if (isObject(item)) {
        // HowToSection wraps further steps in itemListElement.
        if (item['itemListElement']) {
          return normaliseInstructions(item['itemListElement']);
        }
        const text = item['text'] ?? item['name'];
        if (typeof text === 'string') {
          return [text.trim()];
        }
      }
      return [];
    });
  }
  return [];
}

/**
 * Coerce a scalar-or-array string field to a single line of text. Whitespace,
 * line breaks included, collapses to one space: these values become `>> key:`
 * metadata lines, and a line break inside one (from a hostile page) would start
 * a line of its own.
 */
function firstString(value: Json): string | undefined {
  const text =
    typeof value === 'string'
      ? value
      : Array.isArray(value) && typeof value[0] === 'string'
        ? value[0]
        : undefined;
  return text?.replace(/\s+/g, ' ').trim();
}

/** Author display name from schema.org `author` (string, object, or array). */
function authorName(value: Json): string | undefined {
  const node = Array.isArray(value) ? value[0] : value;
  if (typeof node === 'string') {
    return node.trim();
  }
  if (isObject(node)) {
    const name = node['name'];
    if (typeof name === 'string') {
      return name.trim();
    }
  }
  return undefined;
}

/** Image URLs from schema.org `image` (string, ImageObject, or arrays thereof). */
export function imageUrls(value: Json): readonly string[] {
  return validImageUrls(
    listOf(value).flatMap((item) => {
      if (typeof item === 'string') {
        return [item];
      }
      const url = isObject(item)
        ? (item['url'] ?? item['contentUrl'])
        : undefined;
      return typeof url === 'string' ? [url] : [];
    }),
  );
}

/** A value as a list: itself if it is one, nothing if it is missing, else just it. */
function listOf(value: Json): readonly Json[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

/** Video URL from schema.org `video` (VideoObject contentUrl/embedUrl/url). */
function videoUrl(value: Json): string | undefined {
  const node = Array.isArray(value) ? value[0] : value;
  if (typeof node === 'string') {
    return node.trim();
  }
  if (isObject(node)) {
    const url = node['contentUrl'] ?? node['embedUrl'] ?? node['url'];
    if (typeof url === 'string') {
      return url.trim();
    }
  }
  return undefined;
}

/** Join `suitableForDiet` values, stripping the schema.org URL/`Diet` decorations. */
export function dietNames(value: Json): string | undefined {
  const names = listOf(value)
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
 * The `>>` metadata lines for the facts a Recipe node states directly. A fact
 * the node doesn't state (or states emptily) gets no line.
 */
function metadataLines(
  recipe: JsonObject,
  sourceUrl: string | undefined,
): readonly string[] {
  const servings = recipe['recipeYield'];
  // Times (prep + total/cook). The LLM tagging pass later adds the Quick/Med/Long bucket.
  const prep = firstString(recipe['prepTime']);
  const total =
    firstString(recipe['totalTime']) ?? firstString(recipe['cookTime']);
  // Media references (may be mirrored to R2/Images/Stream for permanence later).
  // Space-separated: image URLs can contain commas (e.g. `?resize=440,400`) but
  // never spaces, so whitespace is a safe delimiter (see media.ts).
  const images = imageUrls(recipe['image']);

  const fields: readonly (readonly [string, string | undefined])[] = [
    [
      'servings',
      typeof servings === 'number' ? String(servings) : firstString(servings),
    ],
    ['prep', prep ? humaniseDuration(prep) : undefined],
    ['time', total ? humaniseDuration(total) : undefined],
    // Taxonomy that schema.org carries directly (protein/difficulty/equipment
    // come from the model pass since schema.org has no such fields).
    ['cuisine', firstString(recipe['recipeCuisine'])],
    ['category', firstString(recipe['recipeCategory'])],
    ['diet', dietNames(recipe['suitableForDiet'])],
    ['method', firstString(recipe['cookingMethod'])],
    ['keywords', firstString(recipe['keywords'])],
    // Provenance — preserve where the recipe came from.
    ['author', authorName(recipe['author'])],
    ['published', firstString(recipe['datePublished'])],
    ['source', sourceUrl ?? firstString(recipe['url'])],
    ['images', images.join(' ')],
    ['video', videoUrl(recipe['video'])],
  ];
  return fields.flatMap(([key, value]) =>
    value ? [`>> ${key}: ${value}`] : [],
  );
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
  recipe: JsonObject,
  sourceUrl?: string,
): string {
  const title = firstString(recipe['name']) ?? 'Imported Recipe';
  const meta = [`>> title: ${title}`, ...metadataLines(recipe, sourceUrl)];

  const rawIngredients = recipe['recipeIngredient'] ?? recipe['ingredients'];
  const ingredientLines = Array.isArray(rawIngredients)
    ? rawIngredients
        .filter((i): i is string => typeof i === 'string')
        .map((i) => toCookIngredient(parseIngredientLine(i)))
    : [];

  const steps = normaliseInstructions(recipe['recipeInstructions']);

  const blocks = [
    meta.join('\n'),
    // One paragraph of ingredient tokens → a single "gather" step the parser
    // reads for the ingredients panel. The user curates it into the method.
    ...(ingredientLines.length ? [ingredientLines.join('\n')] : []),
    ...steps,
  ];
  return `${blocks.join('\n\n')}\n`;
}

/**
 * The page's `og:image` (the share-card image), resolved against `baseUrl` and
 * restricted to http(s). A good-enough cover for pages with no Recipe JSON-LD.
 * Handles both attribute orders (`property` before or after `content`).
 */
export function extractOgImage(
  html: string,
  baseUrl?: string,
): string | undefined {
  const forward =
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*?content=["']([^"']+)["']/i.exec(
      html,
    );
  const backward =
    /<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']og:image(?::secure_url)?["']/i.exec(
      html,
    );
  const raw = (forward ?? backward)?.[1]?.replace(/&amp;/g, '&').trim();
  if (!raw) {
    return undefined;
  }
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every object that carries an `@id` (and something besides it), anywhere in
 * the parsed JSON-LD, as `[id, object]` pairs in document order.
 */
function collectById(root: Json): readonly (readonly [string, JsonObject])[] {
  if (Array.isArray(root)) {
    return root.flatMap(collectById);
  }
  if (!isObject(root)) {
    return [];
  }
  const id = root['@id'];
  const own =
    typeof id === 'string' && Object.keys(root).length > 1
      ? [[id, root] as const]
      : [];
  return [...own, ...Object.values(root).flatMap(collectById)];
}

/**
 * Follow `{ "@id": "…" }` references in a recipe's `image`. Sites built on
 * WordPress SEO plugins describe the photo as a separate `ImageObject` and have
 * the Recipe point at it by id, so reading `image` directly finds nothing.
 * References are looked up across every JSON-LD block on the page, since the
 * Recipe and the image often live in different `<script>` tags.
 */
export function resolveImageRefs(
  node: JsonObject,
  byId: ReadonlyMap<string, JsonObject>,
): JsonObject {
  const resolve = (value: Json): Json => {
    if (Array.isArray(value)) {
      return value.map(resolve);
    }
    if (isObject(value)) {
      const id = value['@id'];
      if (typeof id === 'string' && Object.keys(value).length === 1) {
        return byId.get(id) ?? value;
      }
    }
    return value;
  };
  const image = node['image'];
  return image === undefined ? node : { ...node, image: resolve(image) };
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
  const blocks = [...html.matchAll(scriptRe)].flatMap(
    (match): readonly Json[] => {
      try {
        return [JSON.parse((match[1] ?? '').trim())];
      } catch {
        return [];
      }
    },
  );
  // The first block to define an id wins, so the entries are reversed on the
  // way into the Map (a later entry overwrites an earlier one).
  const byId = new Map(blocks.flatMap(collectById).toReversed());
  const node = blocks.map(findRecipeNode).find((found) => found !== null);
  return node ? schemaOrgToCook(resolveImageRefs(node, byId), sourceUrl) : null;
}
