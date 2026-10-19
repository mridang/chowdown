/**
 * @packageDocumentation
 *
 * Checking the recipe bodies the REST API accepts: a new recipe (a name and its
 * Cooklang text) and a replacement for an existing one (Cooklang text alone).
 */

/** Largest Cooklang body accepted, in characters. */
export const MAX_COOKLANG_BYTES = 200_000;

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
  return cooklang.length > MAX_COOKLANG_BYTES ? ['cooklang: too large.'] : [];
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

/**
 * The Cooklang text of a replacement body (`PUT /api/recipes/:id`), or
 * undefined if it is missing, blank or too large.
 */
export function parseReplacementCooklang(body: unknown): string | undefined {
  const cooklang =
    typeof body === 'object' && body !== null
      ? Reflect.get(body, 'cooklang')
      : undefined;
  return typeof cooklang === 'string' &&
    cooklang.trim() &&
    cooklang.length <= MAX_COOKLANG_BYTES
    ? cooklang
    : undefined;
}
