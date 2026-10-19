/**
 * @packageDocumentation
 *
 * What the MCP server advertises: the catalogue of tools an assistant may call,
 * with their input schemas, and the schemas and metadata that tell the host how
 * to draw the results. Pure data; what the tools do is in `tool-calls.ts`.
 *
 * The input schemas are also the contract the server enforces: `tool-calls.ts`
 * checks every call's arguments against them (see `json-schema.ts`) before
 * running anything, so a schema here is a promise about what the tool accepts,
 * not just documentation. They are written in JSON Schema 2020-12, the MCP
 * default dialect, and use only the keywords that checker understands.
 *
 * Descriptions say what a tool does and returns. Advice on *when* to use which
 * tool belongs in the server's instructions, not here.
 */

import { scopeForTool } from '../oauth/scopes';
import { NOT_BLANK } from './json-schema';
import { CARD_RESOURCE_URI, LIST_RESOURCE_URI } from './ui-resources';

/** JSON Schema for the recipe-card `structuredContent` (a parsed recipe + extras). */
const RECIPE_CARD_OUTPUT_SCHEMA = {
  type: 'object',
  required: [
    'id',
    'title',
    'uncurated',
    'metadata',
    'ingredients',
    'cookware',
    'steps',
    'logs',
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    uncurated: { type: 'boolean' },
    source: { type: 'string' },
    metadata: {
      type: 'array',
      items: { type: 'array', items: { type: 'string' } },
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'quantity'],
        properties: { name: { type: 'string' }, quantity: { type: 'string' } },
      },
    },
    cookware: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['kind'],
          properties: { kind: { type: 'string' } },
        },
      },
    },
    logs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['date', 'note'],
        properties: { date: { type: 'string' }, note: { type: 'string' } },
      },
    },
  },
} as const;

/**
 * The `_meta` that links a tool to the View that draws its result, and the
 * words a host shows while the call runs and when it is done (ChatGPT; kept to
 * 64 characters). The View's address is given three ways because hosts read
 * different ones: `ui.resourceUri` (the MCP Apps spec), the flat
 * `ui/resourceUri` (the older form, which the official SDK still writes "for
 * compatibility with older hosts") and `openai/outputTemplate` (ChatGPT).
 */
function viewMeta<const Uri extends string>(
  uri: Uri,
  invoking: string,
  invoked: string,
) {
  return {
    ui: { resourceUri: uri },
    'ui/resourceUri': uri,
    'openai/outputTemplate': uri,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
  } as const;
}

/**
 * Lets the View call the tool itself. ChatGPT only passes a widget's tool calls
 * through for tools that say so; MCP Apps hosts allow it by default (a tool's
 * `visibility` defaults to both the model and the app). Only the read tools the
 * Views call back into carry it, never one that writes.
 */
const WIDGET_CALLABLE = { 'openai/widgetAccessible': true } as const;

/** The `_meta` for a tool that draws the recipe card, by what the tool is doing. */
const cardMeta = (invoking: string, invoked: string) =>
  viewMeta(CARD_RESOURCE_URI, invoking, invoked);

/** The `_meta` for a tool that draws the recipe list, by what the tool is doing. */
const listMeta = (invoking: string, invoked: string) =>
  viewMeta(LIST_RESOURCE_URI, invoking, invoked);

/** JSON Schema for the recipe-list `structuredContent`. */
const RECIPE_LIST_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['recipes'],
  properties: {
    query: { type: 'string' },
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'uncurated'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          uncurated: { type: 'boolean' },
        },
      },
    },
  },
} as const;

/** The longest recipe name or id a tool accepts, in characters (Drive allows 255 in a file name). */
const NAME_MAX = 300;

/** A reference to a saved recipe: its name or its id, never blank. */
const RECIPE_REFERENCE = {
  type: 'string',
  minLength: 1,
  maxLength: NAME_MAX,
  pattern: NOT_BLANK,
} as const;

/** The most results a question-shaped tool (browse, pantry) may be asked for. */
const LIMIT_MAX = 50;

/** How many recipes a plain listing returns when no `limit` is given. */
export const PAGE_DEFAULT = 50;

/** The most recipes one page of a plain listing (all recipes, a name search) may hold. */
export const PAGE_MAX = 200;

/** The furthest into a result an `offset` may reach. */
const OFFSET_MAX = 100_000;

/** `offset`: how many results to skip, to read the next page of a long result. */
const OFFSET = {
  type: 'integer',
  minimum: 0,
  maximum: OFFSET_MAX,
  description:
    'How many results to skip, to read the next page (default 0). A result that was cut short says which offset comes next.',
} as const;

/** A text filter such as a cuisine or a list of them. */
const FACET_TEXT = { type: 'string', maxLength: 200 } as const;

/** A search query: some text with something in it. */
const QUERY = {
  type: 'string',
  minLength: 1,
  maxLength: 500,
  pattern: NOT_BLANK,
} as const;

/** A web address a tool may record or fetch: http or https. */
const WEB_URL = {
  type: 'string',
  maxLength: 2048,
  pattern: '^https?://\\S+$',
} as const;

/**
 * The largest block of page text or Cooklang a tool takes, in characters. The
 * whole call travels as one JSON body of at most a mebibyte, and JSON can spend
 * six bytes on a single character (`\u0000`), so this is kept to a sixth of
 * that: a call that is within the limit here is never refused by the transport
 * for size, which the assistant would see only as a failed request. (A test
 * checks the two numbers against each other.) It is also far more than a recipe
 * needs: the converter reads little past the first twelve thousand characters.
 */
export const CONTENT_MAX = 150_000;

/** The most image links a tool takes at once. */
const IMAGES_MAX = 20;

/** The tools, without the title and hints that {@link TOOL_PRESENTATION} adds. */
const TOOL_DEFINITIONS = [
  {
    name: 'list_recipes',
    description:
      "Lists the names of the recipes saved in the user's Recipes folder, with their ids, 50 at a time (in name order). When there are more, the result says which offset to ask for next.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: PAGE_MAX,
          description: `Most recipes to return (default ${PAGE_DEFAULT}, at most ${PAGE_MAX}).`,
        },
        offset: OFFSET,
      },
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: {
      ...listMeta('Listing your recipes…', 'Here they are'),
      ...WIDGET_CALLABLE,
    },
  },
  {
    name: 'browse_recipes',
    description:
      "Filters the user's saved recipes by cuisine, eating style (vegan, vegetarian, pescatarian, non-vegetarian), protein, dietary needs, category, method, difficulty, maximum time, favourites or part of the name. Every filter is optional and they combine. Returns the matching recipes, with their ids, grouped by eating style, 12 at a time; use offset for the next page. list_filters shows which values the collection holds.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cuisine: {
          ...FACET_TEXT,
          description: "e.g. 'Indian', 'Chinese' (comma-separate several).",
        },
        diet_type: {
          ...FACET_TEXT,
          description:
            "Eating style: 'Vegan', 'Vegetarian', 'Pescatarian' or 'Non-vegetarian' (comma-separate several). Asking for Vegetarian also returns vegan dishes, and Pescatarian also returns vegan and vegetarian ones; Non-vegetarian means meat is wanted. Vegetarian dishes contain no meat or fish; pescatarian ones contain fish but no meat.",
        },
        protein: { ...FACET_TEXT, description: "e.g. 'Chicken', 'Paneer'." },
        dietary_needs: {
          ...FACET_TEXT,
          description: "Dietary needs, e.g. 'Gluten-free', 'Dairy-free'.",
        },
        category: { ...FACET_TEXT, description: "e.g. 'Main', 'Dessert'." },
        method: { ...FACET_TEXT, description: "e.g. 'Baked', 'Grilled'." },
        difficulty: {
          type: 'string',
          maxLength: 20,
          description: 'Easy, Medium or Hard (any capitalisation).',
        },
        max_minutes: {
          type: 'number',
          minimum: 0,
          description: 'Only recipes that take at most this long.',
        },
        favourites_only: {
          type: 'boolean',
          description: 'Only recipes the user has hearted.',
        },
        query: {
          type: 'string',
          maxLength: 200,
          description: 'Text to match in the name.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LIMIT_MAX,
          description: 'Most results (default 12, at most 50).',
        },
        offset: OFFSET,
      },
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: listMeta('Browsing your recipes…', 'Here they are'),
  },
  {
    name: 'recipes_from_ingredients',
    description:
      "Matches the user's saved recipes against ingredients they have, with amounts when known (for example '3 tomatoes', '400 g pasta'). Returns recipes that can be made now and recipes that are only a few ingredients short, saying exactly what is missing or needs more of. Salt, pepper, water and cooking oil are assumed to be on hand unless assume_staples is false.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ingredients: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: { type: 'string', minLength: 1, maxLength: 300 },
          description:
            "What they have, with amounts when known, e.g. ['3 tomatoes', '400 g pasta', 'garlic'].",
        },
        allow_missing: {
          type: 'integer',
          minimum: 0,
          maximum: 20,
          description:
            'How many ingredients a recipe may lack to still be listed as almost there (default 2; 0 for only what can be made now).',
        },
        assume_staples: {
          type: 'boolean',
          description: 'Assume salt, pepper, water and oil (default true).',
        },
        diet_type: {
          ...FACET_TEXT,
          description:
            "Only recipes that suit this eating style, e.g. 'Vegetarian' (which also allows vegan dishes). Comma-separate several.",
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LIMIT_MAX,
          description: 'Most results per list (default 12, at most 50).',
        },
        offset: OFFSET,
      },
      required: ['ingredients'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: listMeta('Matching your ingredients…', 'Here is what fits'),
  },
  {
    name: 'list_filters',
    description:
      "Lists the values the user's saved recipes hold for each filter (cuisine, eating style, protein, category, difficulty and so on), with counts. These are the values browse_recipes accepts.",
    inputSchema: { type: 'object', additionalProperties: false },
  },
  {
    name: 'search_recipes',
    description:
      'By name only: finds saved recipes whose name contains the query, ignoring case and accents, 50 at a time. The words of a dish that is not named in it (for example an ingredient) are for find_recipes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { ...QUERY, description: 'Text to match in recipe names.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: PAGE_MAX,
          description: `Most recipes to return (default ${PAGE_DEFAULT}, at most ${PAGE_MAX}).`,
        },
        offset: OFFSET,
      },
      required: ['query'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: listMeta('Searching your recipes…', 'Here they are'),
  },
  {
    name: 'find_recipes',
    description:
      "By meaning, not name: ranks the user's saved recipes by what they are about (for example 'something with beef that's quick', 'a vegetarian curry'). Returns the best 8 matches. Recipes that have not been indexed yet are indexed on demand, a limited number per call; the result says when some are still waiting.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { ...QUERY, description: 'What the user is looking for.' },
      },
      required: ['query'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: listMeta('Searching your recipes…', 'Here they are'),
  },
  {
    name: 'find_similar',
    description:
      'Finds the saved recipes most similar to a given saved recipe, which is identified by name or id. Returns up to 6, with their ids. Recipes that have not been indexed yet are indexed on demand, a limited number per call.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to find similar ones to: its name, or its id from a list result.',
        },
      },
      required: ['recipe'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: listMeta('Finding similar recipes…', 'Here they are'),
  },
  {
    name: 'get_recipe',
    description:
      'Returns one saved recipe, identified by name or id: its title, details, ingredients with quantities, method steps and cooking log, as text and as a recipe card.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to open: its name, or its id from a list result.',
        },
      },
      required: ['recipe'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: {
      ...cardMeta('Opening the recipe…', 'Here it is'),
      ...WIDGET_CALLABLE,
    },
  },
  {
    name: 'import_recipe',
    description:
      "Creates a saved recipe from the content of a web page that the caller has already fetched: pass the recipe's text as `content` (not a URL), meaning its title, ingredients and steps, or the page's JSON-LD `Recipe` block; the rest of the page is not needed. The server converts it to Cooklang, tags it and saves it in the Recipes folder. If `url` is given it is recorded as the recipe's source, a link that was already imported is not imported twice, and the page is fetched once to look for images. Returns the saved recipe.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: {
          type: 'string',
          minLength: 1,
          maxLength: CONTENT_MAX,
          pattern: NOT_BLANK,
          description:
            "The recipe's text (title, ingredients, steps) or the page's JSON-LD Recipe block; page text or HTML also works, but only the first 12,000 characters are read unless a JSON-LD Recipe is present. Never a URL.",
        },
        url: {
          ...WEB_URL,
          description: 'The source page URL (http or https), for attribution.',
        },
        name: {
          type: 'string',
          maxLength: NAME_MAX,
          description:
            'Optional recipe name; inferred from the content if omitted.',
        },
        images: {
          type: 'array',
          maxItems: IMAGES_MAX,
          items: { type: 'string', maxLength: 2048 },
          description:
            'Image URLs from the page (the og:image or the recipe photo), cover first. Used as the recipe images; the server cannot always fetch the page itself.',
        },
      },
      required: ['content'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Importing the recipe…', 'Imported'),
  },
  {
    name: 'add_recipe',
    description:
      'Saves a recipe the caller has already written in Cooklang as a new file in the Recipes folder, adding tags (cuisine, diet and so on) to the metadata. Saving the same name and recipe again changes nothing. The server does not fetch URLs: `content` must be the recipe text. Cooklang syntax: metadata as `>> key: value` lines at the top (e.g. `>> servings: 4`), ingredients inline as @name{quantity%unit} (e.g. @flour{200%g}, @eggs{2}), cookware as #item{} (e.g. #pan{}) and timers as ~{10%minutes}. Returns the saved recipe.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: NAME_MAX,
          pattern: NOT_BLANK,
          description: 'The recipe name.',
        },
        content: {
          type: 'string',
          minLength: 1,
          maxLength: CONTENT_MAX,
          pattern: NOT_BLANK,
          description: 'The full recipe in Cooklang format. Not a URL.',
        },
      },
      required: ['name', 'content'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Saving the recipe…', 'Saved'),
  },
  {
    name: 'capture_idea',
    description:
      "Saves a placeholder for a recipe to work out later (for example 'paneer ki sabji'): a new file marked as an uncurated idea, holding the original request verbatim and an optional draft.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: NAME_MAX,
          pattern: NOT_BLANK,
          description: 'The dish name to use for the file.',
        },
        prompt: {
          type: 'string',
          minLength: 1,
          maxLength: 20_000,
          pattern: NOT_BLANK,
          description: 'The original request, kept verbatim.',
        },
        draft: {
          type: 'string',
          maxLength: CONTENT_MAX,
          description: 'Optional draft Cooklang recipe.',
        },
      },
      required: ['name', 'prompt'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Saving your idea…', 'Saved'),
  },
  {
    name: 'log_cooking',
    description:
      'Appends a dated cooking-log entry to a saved recipe: a note about a time it was cooked, such as what was changed and how it turned out. The entry is dated today unless `date` says otherwise. Each call adds a new entry.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to add the entry to: its name, or its id from a list result.',
        },
        note: {
          type: 'string',
          minLength: 1,
          maxLength: 5000,
          pattern: NOT_BLANK,
          description: 'What to record about this cook.',
        },
        date: {
          type: 'string',
          maxLength: 10,
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description:
            'The day it was cooked, as YYYY-MM-DD, for a cook that was not today (default: today). Not in the future.',
        },
      },
      required: ['recipe', 'note'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Logging your cook…', 'Logged'),
  },
  {
    name: 'set_measurement_system',
    description:
      "Stores the user's preferred measurement system (metric, us or imperial); recipes are shown in it from then on.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        system: {
          type: 'string',
          enum: ['metric', 'us', 'imperial'],
          description: 'metric, us, or imperial',
        },
      },
      required: ['system'],
    },
  },
  {
    name: 'favourite_recipe',
    description:
      'Marks a saved recipe as a favourite (a heart), or removes the mark when `favourite` is false.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to heart: its name, or its id from a list result.',
        },
        favourite: {
          type: 'boolean',
          description: 'true to heart (default), false to remove the heart.',
        },
      },
      required: ['recipe'],
    },
  },
  {
    name: 'tag_recipe',
    description:
      "Classifies a saved recipe by protein, cuisine, course, diet, difficulty, method and keywords, and writes those tags into the recipe, replacing the recipe's existing values for the same keys. If the recipe records a source page and has no image, that page is fetched once to add a cover image.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to tag: its name, or its id from a list result.',
        },
      },
      required: ['recipe'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Tagging the recipe…', 'Tagged'),
  },
  {
    name: 'set_recipe_images',
    description:
      'Sets the cover image and any extra photos of a saved recipe from http(s) image URLs, cover first, replacing the images it had; or removes all its images when `clear` is true (and no `images` are given). The URLs are stored, not downloaded.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to change: its name, or its id from a list result.',
        },
        images: {
          type: 'array',
          maxItems: IMAGES_MAX,
          items: { type: 'string', maxLength: 2048 },
          description: 'Image URLs (http/https), cover first.',
        },
        clear: {
          type: 'boolean',
          description:
            "true (with no images) to remove the recipe's images instead.",
        },
      },
      required: ['recipe'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Setting the images…', 'Images set'),
  },
  {
    name: 'annotate_recipe',
    description:
      "Adds a personal note to a saved recipe without changing the original text. The note can be attached to one ingredient (`ingredient`), to one step (`step` number), or to the recipe as a whole when both are left out, for example 'use 3 avocados instead of 2'. Each call adds a new note.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        recipe: {
          ...RECIPE_REFERENCE,
          description:
            'The recipe to annotate: its name, or its id from a list result.',
        },
        note: {
          type: 'string',
          minLength: 1,
          maxLength: 5000,
          pattern: NOT_BLANK,
          description: 'The note text.',
        },
        ingredient: {
          type: 'string',
          maxLength: 200,
          description:
            'Attach the note to this ingredient (by name, as it is in the recipe). Not together with `step`.',
        },
        step: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description:
            'Attach the note to this step (1-based number). Not together with `ingredient`.',
        },
      },
      required: ['recipe', 'note'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: cardMeta('Saving your note…', 'Note saved'),
  },
] as const;

/** The name of one of the tools. */
export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];

/** The hints that describe a tool that only reads. */
const READS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** What a tool shows people and tells hosts about its effects. */
interface ToolPresentation {
  /** The name shown in a host's interface. */
  readonly title: string;
  /** The effect hints (see the MCP spec's `ToolAnnotations`). */
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
  };
}

/**
 * The title and effect hints of every tool, in one place. Hosts use the hints
 * to decide when to ask the person before a call, so each is set from what the
 * tool's code really does:
 *
 * - `readOnlyHint` is true exactly for the tools `oauth/scopes.ts` treats as
 *   read-only (a test keeps the two in step). The read tools may fill an
 *   internal cache, or make the empty Recipes folder on first use, but never
 *   change a recipe or a setting.
 * - `destructiveHint` is true when a call can overwrite or remove something a
 *   person wrote: tagging replaces tag values in the recipe file, and setting
 *   images replaces or clears the image list. Appending, creating and flipping a
 *   setting or a heart that the same tool can flip back are not destructive.
 *   `import_recipe` can repair an earlier import by writing over it, but only a
 *   file that holds no ingredients and no steps (anything with content is
 *   returned as it is), so nothing a person wrote can be lost and it stays
 *   `false`.
 * - `idempotentHint` is true when repeating the exact call changes nothing more.
 *   Tools that create a file or append an entry add another each time; tagging
 *   asks a model, whose answer can differ between calls.
 * - `openWorldHint` is true for the tools that fetch a web address: importing
 *   (the source page, for images) and tagging (the source page, for a cover).
 *   Our own database, Drive folder and AI models are a closed world.
 *
 * Typed as a record over {@link ToolName}, so adding a tool without an entry
 * here does not compile.
 */
const TOOL_PRESENTATION: Readonly<Record<ToolName, ToolPresentation>> = {
  list_recipes: { title: 'List my recipes', annotations: READS },
  browse_recipes: {
    title: 'Browse recipes by cuisine, diet or time',
    annotations: READS,
  },
  recipes_from_ingredients: {
    title: 'Find recipes from ingredients',
    annotations: READS,
  },
  list_filters: { title: 'List recipe filters', annotations: READS },
  search_recipes: { title: 'Search recipes by name', annotations: READS },
  find_recipes: { title: 'Search recipes by meaning', annotations: READS },
  find_similar: { title: 'Find similar recipes', annotations: READS },
  get_recipe: { title: 'Open a recipe', annotations: READS },
  import_recipe: {
    title: 'Import a recipe from a web page',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  add_recipe: {
    title: 'Save a recipe',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  capture_idea: {
    title: 'Capture a recipe idea',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  log_cooking: {
    title: 'Log a cook',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  set_measurement_system: {
    title: 'Set measurement system',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  favourite_recipe: {
    title: 'Favourite a recipe',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  tag_recipe: {
    title: 'Tag a recipe',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  set_recipe_images: {
    title: 'Set recipe images',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  annotate_recipe: {
    title: 'Add a note to a recipe',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
};

/**
 * The tool catalogue advertised to clients: each definition with its title (both
 * as the tool's own `title` and in `annotations.title`, which older clients
 * read) and its effect hints.
 */
export const TOOLS = TOOL_DEFINITIONS.map((tool) => {
  const { title, annotations } = TOOL_PRESENTATION[tool.name];
  // What sign-in a call needs, tool by tool: ChatGPT asks for each tool to say
  // so even when the whole server asks the same of every caller. Written in
  // `_meta` as well because some MCP libraries drop unknown top-level fields.
  const securitySchemes = [
    { type: 'oauth2', scopes: [scopeForTool(tool.name)] },
  ] as const;
  return {
    ...tool,
    title,
    annotations: { title, ...annotations },
    securitySchemes,
    _meta: {
      ...('_meta' in tool ? tool._meta : {}),
      securitySchemes,
    },
  };
});

/** The advertised tool with this name, if there is one. */
export function toolNamed(name: string): (typeof TOOLS)[number] | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
