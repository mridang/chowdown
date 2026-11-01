/**
 * @packageDocumentation
 *
 * What this app's connector has of its own, read by the shared OAuth and MCP
 * code (`lib/oauth/`, `lib/mcp/`): the names of its two scopes and what they
 * allow in words, which tools only read, the name its protected resource goes
 * by, and the looser spellings of tool arguments it accepts. Everything in
 * those libraries is the same in every app.
 */

/** May browse, search and view recipes. */
export const SCOPE_READ = 'recipes:read';
/** May change recipes, the user's settings and their notes (implies read). */
export const SCOPE_WRITE = 'recipes:write';

/** What each scope lets the app do, in plain words, for the approval screen. */
export const SCOPE_TEXT: Readonly<Record<string, string>> = {
  [SCOPE_READ]: 'See your recipes, search them and find similar ones',
  [SCOPE_WRITE]:
    'Add, edit, tag, favourite and annotate recipes, and change your settings',
};

/**
 * What a read-only connection may still do, in a few words, for the approval
 * screen's choice to allow less than the app asked for ("Read only: …, but
 * change nothing").
 */
export const READ_ONLY_TEXT = 'see and search recipes';

/**
 * Tools that only read. Anything not listed here is treated as a write, so a
 * newly added tool is protected by default until someone classifies it.
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'list_recipes',
  'search_recipes',
  'find_recipes',
  'find_similar',
  'get_recipe',
  'browse_recipes',
  'recipes_from_ingredients',
  'list_filters',
]);

/** The name of the protected resource, in its RFC 9728 metadata. */
export const RESOURCE_NAME = 'Chowdown recipes';

/**
 * Older or looser spellings of a tool's arguments, and the canonical name each
 * one stands for. The catalogue lists only the canonical names (so a model sees
 * one way to say each thing, and the input schemas stay closed), but a
 * connector that cached an earlier catalogue, or a model that carries an
 * argument over from a similar tool, must not start failing: its spelling is
 * renamed before the arguments are checked.
 */
export const ARGUMENT_ALIASES: Readonly<
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
export const LISTS_OF_TEXT: Readonly<Record<string, readonly string[]>> = {
  recipes_from_ingredients: ['ingredients'],
};
