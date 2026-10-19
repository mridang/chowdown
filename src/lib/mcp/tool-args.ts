/**
 * @packageDocumentation
 *
 * Reading the `arguments` of an MCP tool call. They arrive as untrusted JSON
 * from an assistant, which may send a number as a string, one value where a
 * list was expected, or nothing at all, so every reader here takes `unknown`
 * and answers with a plain, safe value instead of throwing.
 */

/** The most results a tool returns unless asked for fewer. */
const DEFAULT_LIMIT = 12;

/** The most results a tool will ever return, whatever is asked. */
const MAX_LIMIT = 50;

/** A string argument, trimmed; empty when absent or not a string. */
export function stringArg(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * An argument given as one string or a list of them, as a list. Numbers count
 * as strings, commas split ("a, b" is two values), and blanks are dropped.
 */
export function stringListArg(value: unknown): readonly string[] {
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  return list
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

/** A number argument, also accepting a numeric string; undefined otherwise. */
export function numberArg(value: unknown): number | undefined {
  const n =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/** The result limit asked for, whole and kept within 1 to 50 (12 when not given). */
export function limitArg(value: unknown): number {
  const n = numberArg(value);
  return Math.min(
    Math.max(n === undefined ? DEFAULT_LIMIT : Math.floor(n), 1),
    MAX_LIMIT,
  );
}

/** The position to start a page of results from: a whole number, never negative (0 when not given). */
export function offsetArg(value: unknown): number {
  const n = numberArg(value);
  return n === undefined ? 0 : Math.max(Math.floor(n), 0);
}

/**
 * Older or looser spellings of a tool's arguments, and the canonical name each
 * one stands for. The catalogue lists only the canonical names (so a model sees
 * one way to say each thing, and the input schemas stay closed), but a
 * connector that cached an earlier catalogue, or a model that carries an
 * argument over from a similar tool, must not start failing: its spelling is
 * renamed before the arguments are checked.
 */
const ARGUMENT_ALIASES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  get_recipe: { name: 'recipe' },
  find_similar: { name: 'recipe' },
  browse_recipes: { diet: 'dietary_needs' },
};

/**
 * Arguments that are declared as a list of text but that models often send as
 * one piece of text ("3 tomatoes and 400 g pasta"). That text is wrapped into a
 * one-item list; the reader of the list already knows how to split a sentence.
 */
const LISTS_OF_TEXT: Readonly<Record<string, readonly string[]>> = {
  recipes_from_ingredients: ['ingredients'],
};

/**
 * The arguments of a call to `tool`, with the harmless slips of
 * {@link ARGUMENT_ALIASES} and {@link LISTS_OF_TEXT} put right. Nothing else is
 * guessed: a number sent as text, a wrong type or an unknown name is still left
 * for the schema check to refuse, so the assistant is told and can say it right.
 * When both an alias and its canonical name are present the arguments are left
 * as they are, and the check refuses the alias.
 */
export function canonicalArguments(
  tool: string,
  args: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const aliases = Object.hasOwn(ARGUMENT_ALIASES, tool)
    ? Object.entries(ARGUMENT_ALIASES[tool] ?? {})
    : [];
  const renamed = Object.fromEntries(
    Object.entries(args).map(([key, value]) => {
      const alias = aliases.find(([from]) => from === key);
      return alias && !Object.hasOwn(args, alias[1])
        ? [alias[1], value]
        : [key, value];
    }),
  );
  const lists = Object.hasOwn(LISTS_OF_TEXT, tool)
    ? (LISTS_OF_TEXT[tool] ?? [])
    : [];
  return Object.fromEntries(
    Object.entries(renamed).map(([key, value]) => [
      key,
      lists.includes(key) && typeof value === 'string' ? [value] : value,
    ]),
  );
}

/**
 * An argument read as text the way the tools always have: a missing value
 * becomes empty, and anything that is not a string is spelled out with
 * `String()` (so `5` is "5"). Unlike {@link stringArg} it does not trim.
 */
export function textArg(value: unknown): string {
  return String(value ?? '');
}
