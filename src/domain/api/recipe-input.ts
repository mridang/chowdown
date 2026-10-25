/**
 * @packageDocumentation
 *
 * Checking the recipe bodies the REST API accepts: a new recipe (a name and its
 * Cooklang text) and a replacement for an existing one (Cooklang text alone).
 */

/** Largest Cooklang body accepted, in characters. */
export const MAX_COOKLANG_BYTES = 200_000;

/**
 * Most lines of Cooklang accepted. Real recipes run to dozens of lines; the
 * Cooklang parser's work grows with the square of the line count (20,000 blank
 * lines cost it over a second), so a text of nothing but line breaks, which fits
 * the character limit, could otherwise tie the server up for minutes.
 */
export const MAX_COOKLANG_LINES = 5_000;

/**
 * Largest request body a recipe route reads, in bytes. The Cooklang limit above
 * counts characters; the body carries them as UTF-8 inside JSON, where a line
 * break takes two bytes and an emoji four, so a recipe at the limit needs well
 * over the 256 KiB other routes get. 1 MiB covers it with room to spare.
 */
export const MAX_RECIPE_BODY_BYTES = 1024 * 1024;

/** The longest recipe name accepted. */
const MAX_NAME_LENGTH = 200;

/** A checked new recipe, or what was wrong with it. */
export type NewRecipeInput =
  | {
      readonly ok: true;
      readonly name: string;
      readonly cooklang: string;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

/** What is wrong with the `name` member, if anything. */
function nameErrors(name: unknown): readonly string[] {
  return typeof name !== 'string' ||
    !name.trim() ||
    name.length > MAX_NAME_LENGTH
    ? [`name: required, up to ${MAX_NAME_LENGTH} characters.`]
    : [];
}

/** What is wrong with the `cooklang` member, if anything. */
function cooklangErrors(cooklang: unknown): readonly string[] {
  if (typeof cooklang !== 'string' || !cooklang.trim()) {
    return ['cooklang: required.'];
  }
  if (cooklang.length > MAX_COOKLANG_BYTES) {
    return ['cooklang: too large.'];
  }
  return cooklang.split('\n').length > MAX_COOKLANG_LINES
    ? [`cooklang: at most ${MAX_COOKLANG_LINES} lines.`]
    : [];
}

/**
 * Check the body of `POST /api/recipes`: a `name` (up to 200 characters) and
 * the recipe as `cooklang` text (up to 200,000). The name is returned as sent;
 * the route trims it when it names the file.
 */
export function parseNewRecipe(
  body: Readonly<Record<string, unknown>>,
): NewRecipeInput {
  const { name, cooklang } = body;
  const errors = [...nameErrors(name), ...cooklangErrors(cooklang)];
  return errors.length > 0 ||
    typeof name !== 'string' ||
    typeof cooklang !== 'string'
    ? { ok: false, errors }
    : { ok: true, name, cooklang };
}

/** The checked Cooklang text of a replacement, or what was wrong with it. */
export type ReplacementInput =
  | { readonly ok: true; readonly cooklang: string }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Check the body of `PUT /api/recipes/:id`: the recipe's new Cooklang text as
 * `cooklang`, held to the same limits as a new recipe.
 */
export function parseReplacementCooklang(body: unknown): ReplacementInput {
  const cooklang =
    typeof body === 'object' && body !== null
      ? Reflect.get(body, 'cooklang')
      : undefined;
  const errors = cooklangErrors(cooklang);
  return errors.length > 0 || typeof cooklang !== 'string'
    ? { ok: false, errors }
    : { ok: true, cooklang };
}
