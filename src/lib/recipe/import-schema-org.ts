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
 * each ingredient (see `ingredient-line.ts`) and emit `@name{qty%unit}` on a
 * best-effort basis. The result is a valid, editable `.cook` the user curates — not a perfect
 * reconstruction. The fetch/HTML side lives in the caller; everything here is
 * pure and unit-tested.
 */

import { authorEvidence, declaredAuthor, hasAuthor } from './author';
import { upsertMetadata } from './cook-text';
import { scanHtml, type Attributes } from './import-html-scan';
import { parseIngredientLine, toCookIngredient } from './ingredient-line';
import { validImageUrls } from './media';

/** A loose JSON value — JSON-LD arrives without a fixed shape. */
type Json = unknown;

/** A JSON object whose members are not yet known to be anything in particular. */
type JsonObject = Readonly<Record<string, Json>>;

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

/**
 * How deep the walks over parsed JSON-LD go. Real structured data is a few
 * levels deep (`@graph`, then a node, then its parts); a hostile page can nest
 * arrays a hundred thousand deep, which would otherwise end the walk in a stack
 * overflow.
 */
const MAX_DEPTH = 24;

/** Whether a parsed JSON value is a container (arrays count: they hold members too). */
function isJsonContainer(value: Json): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

/** True if a JSON-LD node's `@type` is (or includes) `Recipe`. */
function isRecipeNode(node: Json): node is JsonObject {
  if (!isJsonContainer(node)) {
    return false;
  }
  const type = node['@type'];
  return Array.isArray(type) ? type.includes('Recipe') : type === 'Recipe';
}

/** {@link findRecipeNode}, `depth` levels down. */
function findRecipeNodeAt(input: Json, depth: number): JsonObject | null {
  if (depth > MAX_DEPTH) {
    return null;
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findRecipeNodeAt(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (isJsonContainer(input)) {
    if (isRecipeNode(input)) {
      return input;
    }
    const graph = input['@graph'];
    if (graph) {
      return findRecipeNodeAt(graph, depth + 1);
    }
  }
  return null;
}

/**
 * Find the first `Recipe` node anywhere in a parsed JSON-LD value — handling a
 * bare object, an array of nodes, or a `@graph` wrapper (all three occur in
 * the wild). Gives up on structure nested deeper than any real page's.
 */
export function findRecipeNode(input: Json): JsonObject | null {
  return findRecipeNodeAt(input, 0);
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
      if (isJsonContainer(item)) {
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
  if (isJsonContainer(node)) {
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
      const url = isJsonContainer(item)
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
  if (isJsonContainer(node)) {
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

/** The `property`/`name` values that mark a page's share-card image. */
const OG_IMAGE_KEYS: ReadonlySet<string> = new Set([
  'og:image',
  'og:image:secure_url',
]);

/** The share-card image address a `<meta>` tag carries, if it is that tag. */
function ogImageOf(meta: Attributes): string | undefined {
  const marksImage = [meta.get('property'), meta.get('name')].some(
    (key) => key !== undefined && OG_IMAGE_KEYS.has(key.trim().toLowerCase()),
  );
  const content = meta.get('content')?.replace(/&amp;/g, '&').trim();
  return marksImage && content ? content : undefined;
}

/**
 * The page's `og:image` (the share-card image), resolved against `baseUrl` and
 * restricted to http(s). A good-enough cover for pages with no Recipe JSON-LD.
 * Handles both attribute orders (`property` before or after `content`). The
 * page is read by the linear scanner in `import-html-scan.ts`, so a hostile
 * page cannot make this slow.
 */
export function extractOgImage(
  html: string,
  baseUrl?: string,
): string | undefined {
  const raw = scanHtml(html).metas.map(ogImageOf).find(Boolean);
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

/** {@link collectById}, `depth` levels down. */
function collectByIdAt(
  root: Json,
  depth: number,
): readonly (readonly [string, JsonObject])[] {
  if (depth > MAX_DEPTH) {
    return [];
  }
  if (Array.isArray(root)) {
    return root.flatMap((item) => collectByIdAt(item, depth + 1));
  }
  if (!isJsonContainer(root)) {
    return [];
  }
  const id = root['@id'];
  const own =
    typeof id === 'string' && Object.keys(root).length > 1
      ? [[id, root] as const]
      : [];
  return [
    ...own,
    ...Object.values(root).flatMap((member) =>
      collectByIdAt(member, depth + 1),
    ),
  ];
}

/**
 * Every object that carries an `@id` (and something besides it), anywhere in
 * the parsed JSON-LD, as `[id, object]` pairs in document order.
 */
function collectById(root: Json): readonly (readonly [string, JsonObject])[] {
  return collectByIdAt(root, 0);
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
  const resolve = (value: Json, depth: number): Json => {
    if (depth > MAX_DEPTH) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => resolve(item, depth + 1));
    }
    if (isJsonContainer(value)) {
      const id = value['@id'];
      if (typeof id === 'string' && Object.keys(value).length === 1) {
        return byId.get(id) ?? value;
      }
    }
    return value;
  };
  const image = node['image'];
  return image === undefined ? node : { ...node, image: resolve(image, 0) };
}

/**
 * Pull `Recipe` JSON-LD out of a page's HTML and convert it. Returns null when
 * the page has no parseable recipe. Needs no DOM, so it runs in the Worker; the
 * page is read by the linear scanner in `import-html-scan.ts` (a page is
 * untrusted input), and malformed JSON-LD blocks are skipped rather than
 * throwing.
 */
export function extractRecipeFromHtml(
  html: string,
  sourceUrl?: string,
): string | null {
  const blocks = scanHtml(html).jsonLd.flatMap((text): readonly Json[] => {
    try {
      return [JSON.parse(text.trim())];
    } catch {
      return [];
    }
  });
  // The first block to define an id wins, so the entries are reversed on the
  // way into the Map (a later entry overwrites an earlier one).
  const byId = new Map(blocks.flatMap(collectById).toReversed());
  const node = blocks.map(findRecipeNode).find((found) => found !== null);
  if (!node) {
    return null;
  }
  const cook = schemaOrgToCook(resolveImageRefs(node, byId), sourceUrl);
  // Most sites credit the author on the page's Article, or in a meta tag, and
  // not on the Recipe, which is the only place the conversion above looks.
  const author = hasAuthor(cook)
    ? undefined
    : declaredAuthor(authorEvidence(html));
  return author ? upsertMetadata(cook, [['author', author]]) : cook;
}
