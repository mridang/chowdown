/**
 * @packageDocumentation
 *
 * What the MCP server advertises: the catalogue of tools an assistant may call,
 * with their input schemas, and the schemas and metadata that tell the host how
 * to draw the results. Pure data; what the tools do is in `tool-calls.ts`.
 */

import { CARD_RESOURCE_URI, LIST_RESOURCE_URI } from './ui-resources';

/** JSON Schema for the recipe-card `structuredContent` (a parsed recipe + extras). */
const RECIPE_CARD_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'ingredients', 'steps'],
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
        properties: { name: { type: 'string' }, quantity: { type: 'string' } },
      },
    },
    cookware: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      items: { type: 'array', items: { type: 'object' } },
    },
    logs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, note: { type: 'string' } },
      },
    },
  },
} as const;

/** The `_meta` a render-tool definition carries so the host renders the card. */
const CARD_TOOL_META = {
  ui: { resourceUri: CARD_RESOURCE_URI },
  'openai/outputTemplate': CARD_RESOURCE_URI,
  'openai/toolInvocation/invoking': 'Opening the recipe…',
  'openai/toolInvocation/invoked': 'Here it is',
} as const;

/** The `_meta` a list tool definition carries so the host renders the list. */
const LIST_TOOL_META = {
  ui: { resourceUri: LIST_RESOURCE_URI },
  'openai/outputTemplate': LIST_RESOURCE_URI,
  'openai/toolInvocation/invoking': 'Finding your recipes…',
  'openai/toolInvocation/invoked': 'Here they are',
} as const;

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
        required: ['id', 'title'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          uncurated: { type: 'boolean' },
        },
      },
    },
  },
} as const;

/** The tool catalogue advertised to clients. */
export const TOOLS = [
  {
    name: 'list_recipes',
    description: "List the names of all the user's saved recipes.",
    inputSchema: { type: 'object', properties: {} },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
  },
  {
    name: 'browse_recipes',
    description:
      "Browse the user's saved recipes by what they feel like cooking: cuisine ('I feel like Indian'), eating style (vegan, vegetarian, pescatarian, non-vegetarian), protein, dietary needs, category, method, difficulty or time. Every filter is optional and they combine. Results come back grouped by eating style. Use list_filters first if unsure which values exist.",
    inputSchema: {
      type: 'object',
      properties: {
        cuisine: {
          type: 'string',
          description: "e.g. 'Indian', 'Chinese' (comma-separate several).",
        },
        diet_type: {
          type: 'string',
          description:
            "Eating style: 'Vegan', 'Vegetarian', 'Pescatarian' or 'Non-vegetarian' (comma-separate several). Asking for Vegetarian also returns vegan dishes, and Pescatarian also returns vegan and vegetarian ones; Non-vegetarian means meat is wanted. Vegetarian dishes contain no meat or fish; pescatarian ones contain fish but no meat.",
        },
        protein: { type: 'string', description: "e.g. 'Chicken', 'Paneer'." },
        diet: {
          type: 'string',
          description: "Dietary needs, e.g. 'Gluten-free', 'Dairy-free'.",
        },
        category: { type: 'string', description: "e.g. 'Main', 'Dessert'." },
        method: { type: 'string', description: "e.g. 'Baked', 'Grilled'." },
        difficulty: { type: 'string', description: 'Easy, Medium or Hard.' },
        max_minutes: {
          type: 'number',
          description: 'Only recipes that take at most this long.',
        },
        favourites_only: { type: 'boolean' },
        query: { type: 'string', description: 'Text to match in the name.' },
        limit: { type: 'number', description: 'Most results (default 12).' },
      },
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
  },
  {
    name: 'recipes_from_ingredients',
    description:
      "Find recipes the user can cook with what they have in the kitchen ('I have 3 tomatoes and 400 g of pasta — what can I make?'). Returns recipes they can make now, and ones that are only a couple of ingredients short, saying exactly what is missing or needs more of. Salt, pepper, water and cooking oil are assumed to be in the kitchen.",
    inputSchema: {
      type: 'object',
      properties: {
        ingredients: {
          type: 'array',
          items: { type: 'string' },
          description:
            "What they have, with amounts when known, e.g. ['3 tomatoes', '400 g pasta', 'garlic'].",
        },
        allow_missing: {
          type: 'number',
          description:
            'How many ingredients a recipe may lack to still be listed as almost there (default 2; 0 for only what can be made now).',
        },
        assume_staples: {
          type: 'boolean',
          description: 'Assume salt, pepper, water and oil (default true).',
        },
        diet_type: {
          type: 'string',
          description:
            "Only recipes that suit this eating style, e.g. 'Vegetarian' (which also allows vegan dishes). Comma-separate several.",
        },
        limit: {
          type: 'number',
          description: 'Most results per list (default 12).',
        },
      },
      required: ['ingredients'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
  },
  {
    name: 'list_filters',
    description:
      "List what the user's collection holds by cuisine, eating style (vegan / vegetarian / pescatarian / non-vegetarian), protein, category, difficulty and so on, with counts. Use it to see what browse_recipes can filter on.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_recipes',
    description: 'Find recipes whose name matches a query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to match in recipe names.',
        },
      },
      required: ['query'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
  },
  {
    name: 'find_recipes',
    description:
      "Semantic search over the user's recipes — find recipes by what they are about, not just the name (e.g. 'something with beef that's quick', 'a vegetarian curry'). Returns the best matches.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the user is looking for.' },
      },
      required: ['query'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
  },
  {
    name: 'find_similar',
    description:
      'Find recipes similar to a given recipe (by name). Returns the most similar recipes the user has saved.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The recipe to find similar ones to.',
        },
      },
      required: ['name'],
    },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
  },
  {
    name: 'get_recipe',
    description:
      'Get the full Cooklang source and details of one recipe by name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The recipe name to open.' },
      },
      required: ['name'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'import_recipe',
    description:
      "Import a recipe from a web page the user linked. Fetch/open the page YOURSELF and pass the page's raw content (article text or HTML) as `content` — do NOT convert it to Cooklang yourself; chowdown generates the Cooklang so the format stays consistent. Optionally pass the source `url` and a `name`.",
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description:
            "The recipe page's raw text or HTML that you fetched. This must be the page content, never a URL.",
        },
        url: {
          type: 'string',
          description: 'The source page URL, for attribution.',
        },
        name: {
          type: 'string',
          description:
            'Optional recipe name; inferred from the content if omitted.',
        },
        images: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Image URLs from the page (the og:image or the recipe photo), cover first. Pass these whenever you can see them — the server often cannot fetch the page itself.',
        },
      },
      required: ['content'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'add_recipe',
    description:
      'Save a recipe you already have as Cooklang (e.g. one the user dictated). For importing from a web page, prefer import_recipe. This tool does NOT fetch URLs or browse the web — if the user gives a link, YOU open and read the page yourself, extract the recipe, and pass it here. Convert it to Cooklang: put metadata at the top as `>> key: value` lines (e.g. `>> servings: 4`), write ingredients inline as @name{quantity%unit} (e.g. @flour{200%g}, @eggs{2}), cookware as #item{} (e.g. #pan{}), and timers as ~{10%minutes}. Pass the full Cooklang text as `content`.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The recipe name.' },
        content: {
          type: 'string',
          description:
            'The full recipe in Cooklang format, which you convert from the source. Never pass a URL here — pass the actual recipe text.',
        },
      },
      required: ['name', 'content'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'capture_idea',
    description:
      "Save a recipe idea to figure out later (e.g. 'paneer ki sabji'). Stored as an uncurated stub with the original request preserved.",
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The dish name to use for the file.',
        },
        prompt: {
          type: 'string',
          description: 'The original request, kept verbatim.',
        },
        draft: {
          type: 'string',
          description: 'Optional draft Cooklang recipe.',
        },
      },
      required: ['name', 'prompt'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'log_cooking',
    description:
      'Append a dated note to an existing recipe about a time you cooked it (ingredients used, tweaks, how it turned out).',
    inputSchema: {
      type: 'object',
      properties: {
        recipe: {
          type: 'string',
          description: 'Name of the recipe to annotate.',
        },
        note: {
          type: 'string',
          description: 'What to record about this cook.',
        },
      },
      required: ['recipe', 'note'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'set_measurement_system',
    description:
      "Remember the user's preferred measurement system so recipes are shown in it. Call this when the user asks for metric, US, or imperial units.",
    inputSchema: {
      type: 'object',
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
      'Heart (favourite) a recipe, or remove the heart. Call this when the user says they love a recipe or want to favourite/unfavourite it.',
    inputSchema: {
      type: 'object',
      properties: {
        recipe: { type: 'string', description: 'Name of the recipe to heart.' },
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
      'Auto-tag a recipe: classify it by protein, cuisine, course, diet, difficulty, method and keywords and write those tags onto the recipe. Call this when the user asks to tag, categorise or organise a recipe.',
    inputSchema: {
      type: 'object',
      properties: {
        recipe: { type: 'string', description: 'Name of the recipe to tag.' },
      },
      required: ['recipe'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'set_recipe_images',
    description:
      "Set the cover image (and any extra photos) of a saved recipe. Pass the image URLs you can see on the recipe's page, cover first. Use this when a recipe has no picture.",
    inputSchema: {
      type: 'object',
      properties: {
        recipe: { type: 'string', description: 'Name of the recipe.' },
        images: {
          type: 'array',
          items: { type: 'string' },
          description: 'Image URLs (http/https), cover first.',
        },
        clear: {
          type: 'boolean',
          description:
            "Set true (with an empty images list) to remove the recipe's images instead.",
        },
      },
      required: ['recipe'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
  {
    name: 'annotate_recipe',
    description:
      "Add a personal note to a recipe without changing the original. Attach it to an ingredient (pass `ingredient`), to a step (pass `step` number), or leave both out for a general note. Use this when the user wants to remember a tweak, e.g. 'use 3 avocados instead of 2' or 'marinate overnight'.",
    inputSchema: {
      type: 'object',
      properties: {
        recipe: {
          type: 'string',
          description: 'Name of the recipe to annotate.',
        },
        note: { type: 'string', description: 'The note text.' },
        ingredient: {
          type: 'string',
          description: 'Attach the note to this ingredient (by name).',
        },
        step: {
          type: 'number',
          description: 'Attach the note to this step (1-based number).',
        },
      },
      required: ['recipe', 'note'],
    },
    outputSchema: RECIPE_CARD_OUTPUT_SCHEMA,
    _meta: CARD_TOOL_META,
  },
] as const;
