/**
 * @packageDocumentation
 *
 * A minimal Model Context Protocol server over JSON-RPC 2.0, exposed per user
 * at `/api/mcp/<mcp_token>`. It lets an assistant (Claude, ChatGPT, …) work
 * with the user's recipes headlessly: list and search them, read one, capture
 * a recipe idea as an "uncurated" stub, and log a cook onto an existing recipe.
 *
 * Drive access is via the user's stored refresh token, so the tools work with
 * no browser open. This is deliberately hand-rolled (no SDK) to keep the
 * Worker bundle small and the transport simple: each POST carries one JSON-RPC
 * message and gets one JSON response.
 */

import { getUserAccessToken } from '../auth/current-user';
import { setFavourite } from '../db/favourites';
import { findRecipeBySourceUrl } from '../db/recipes';
import { setUserUnits, type User } from '../db/users';
import {
  createRecipeFile,
  ensureRecipesFolder,
  getFileContent,
  listRecipeFiles,
  updateRecipeFile,
  type DriveFile,
} from '../drive/drive-client';
import {
  appendCookingLog,
  appendNote,
  buildStubSource,
  extractCookingLogs,
  isUncurated,
  recipeDisplayName,
  uncuratedFilename,
} from '../recipe/cook-text';
import { parseRecipe } from '../recipe/cooklang';
import { embedText } from '../recipe/embeddings';
import { ensureEmbeddings, topSimilar } from '../recipe/similar';
import { indexRecipeWrite } from '../recipe/tag-index';
import { tagCookSource, tagCookSourceBestEffort } from '../recipe/tagging';
import {
  addMissingCover,
  convertImport,
  hasRecipeBody,
} from '../recipe/to-cooklang';
import { convertRecipe, isUnitSystem, type UnitSystem } from '../recipe/units';
import { getDatabase, getEnv } from '../util';
import { html as recipeCardHtml } from '../../views/generated/recipe-card';
import { html as recipeListHtml } from '../../views/generated/recipe-list';
import type { RecipeCardData, RecipeListData } from './ui-types';

/**
 * MIME type the MCP Apps spec requires for UI resources. Defined locally so the
 * Worker bundle stays lean (the ext-apps/server package pulls the Node SDK in);
 * a unit test asserts this equals the official `RESOURCE_MIME_TYPE` constant.
 */
const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/** The `ui://` URI of the interactive recipe card View. */
const CARD_RESOURCE_URI = 'ui://recipe/card.html';

/** The `ui://` URI of the recipe list View. */
const LIST_RESOURCE_URI = 'ui://recipe/list.html';

/** UI metadata attached to the card resource (rendering + CSP preferences). */
const CARD_UI_META = {
  ui: {
    prefersBorder: true,
    domain: 'https://chowdown.apps.mrida.ng',
    csp: { connectDomains: [] as string[], resourceDomains: [] as string[] },
  },
  'openai/widgetPrefersBorder': true,
  'openai/widgetDomain': 'https://chowdown.apps.mrida.ng',
} as const;

/** The app's UI resources, served via resources/list and resources/read. */
const APP_RESOURCES = [
  {
    uri: CARD_RESOURCE_URI,
    name: 'Recipe card',
    description: 'Interactive chowdown recipe card.',
    html: recipeCardHtml,
  },
  {
    uri: LIST_RESOURCE_URI,
    name: 'Recipe list',
    description: 'The chowdown recipe list.',
    html: recipeListHtml,
  },
] as const;

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

/** Metadata keys worth showing in the card's meta row (the rest stay in the file). */
const CARD_META_KEYS = new Set([
  'servings',
  'prep',
  'time',
  'cuisine',
  'category',
  'difficulty',
  'diet',
  'protein',
  'method',
]);

/**
 * Build the card `structuredContent` for a recipe file, converting quantities
 * to the user's preferred measurement system when one is set. The visible meta
 * row is filtered to the useful facets; provenance/media/keywords stay in the
 * file but aren't dumped into the card.
 */
export function buildRecipeCardData(
  id: string,
  filename: string,
  source: string,
  system?: UnitSystem,
): RecipeCardData {
  const parsed = parseRecipe(source, filename);
  const recipe = system ? convertRecipe(parsed, system) : parsed;
  const sourceMeta = recipe.metadata.find(([key]) => key === 'source')?.[1];
  return {
    ...recipe,
    metadata: recipe.metadata.filter(([key]) =>
      CARD_META_KEYS.has(key.toLowerCase()),
    ),
    id,
    uncurated: isUncurated(filename),
    source: sourceMeta,
    logs: extractCookingLogs(source),
  };
}

/** Build the list `structuredContent` from a set of Drive files. */
function buildRecipeListData(
  files: DriveFile[],
  query?: string,
): RecipeListData {
  const recipes = files.map((f) => ({
    id: f.id,
    title: recipeDisplayName(f.name),
    uncurated: isUncurated(f.name),
  }));
  return query ? { recipes, query } : { recipes };
}

/** A tool result that renders the recipe card (terse model text + card data). */
function recipeCardResult(
  id: string,
  filename: string,
  source: string,
  message: string,
  system?: UnitSystem,
): object {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: buildRecipeCardData(id, filename, source, system),
    _meta: { 'openai/outputTemplate': CARD_RESOURCE_URI },
  };
}

/** A tool result that renders the recipe list. */
function recipeListResult(
  files: DriveFile[],
  message: string,
  query?: string,
): object {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: buildRecipeListData(files, query),
    _meta: { 'openai/outputTemplate': LIST_RESOURCE_URI },
  };
}

/** MCP protocol revision this server implements. */
const PROTOCOL_VERSION = '2024-11-05';

/** A JSON-RPC 2.0 request/notification. */
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

/** The tool catalogue advertised to clients. */
const TOOLS = [
  {
    name: 'list_recipes',
    description: "List the names of all the user's saved recipes.",
    inputSchema: { type: 'object', properties: {} },
    outputSchema: RECIPE_LIST_OUTPUT_SCHEMA,
    _meta: LIST_TOOL_META,
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

/** Resolve a fresh Drive token and the user's Recipes folder id. */
async function driveContext(
  user: User,
): Promise<{ token: string; folderId: string }> {
  const token = await getUserAccessToken(user);
  const folderId = user.recipes_folder_id ?? (await ensureRecipesFolder(token));
  return { token, folderId };
}

/** Find a recipe file whose display name best matches `name` (case-insensitive). */
function matchFile(files: DriveFile[], name: string): DriveFile | undefined {
  const target = name.trim().toLowerCase();
  return (
    files.find((f) => recipeDisplayName(f.name).toLowerCase() === target) ??
    files.find((f) => recipeDisplayName(f.name).toLowerCase().includes(target))
  );
}

/** Wrap text as an MCP tool result. */
function text(body: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: body }] };
}

/** Execute a `tools/call`. */
async function callTool(
  user: User,
  params: Record<string, unknown> | undefined,
): Promise<object> {
  const name = params?.['name'] as string | undefined;
  const args =
    (params?.['arguments'] as Record<string, unknown> | undefined) ?? {};

  // set_measurement_system just records a preference — handle it before the
  // Drive round-trip the recipe tools need.
  if (name === 'set_measurement_system') {
    const sys = String(args['system'] ?? '').toLowerCase();
    if (!isUnitSystem(sys)) {
      return {
        ...text('Please choose metric, us, or imperial.'),
        isError: true,
      };
    }
    await setUserUnits(getDatabase(), user.id, sys);
    return text(`Done — I'll show recipes in ${sys} units from now on.`);
  }

  const { token, folderId } = await driveContext(user);
  // The user's preferred measurement system, applied to every recipe card.
  const system = isUnitSystem(user.units ?? '')
    ? (user.units as UnitSystem)
    : undefined;

  switch (name) {
    case 'list_recipes': {
      const files = await listRecipeFiles(folderId, token);
      return recipeListResult(
        files,
        files.length
          ? `Showing your ${files.length} recipes.`
          : 'No recipes yet.',
      );
    }
    case 'search_recipes': {
      const queryRaw = String(args['query'] ?? '');
      const query = queryRaw.toLowerCase();
      const files = await listRecipeFiles(folderId, token);
      const hits = files.filter((f) =>
        recipeDisplayName(f.name).toLowerCase().includes(query),
      );
      return recipeListResult(
        hits,
        hits.length
          ? `Found ${hits.length} recipe(s) matching "${queryRaw}".`
          : `No recipes match "${queryRaw}".`,
        queryRaw,
      );
    }
    case 'find_recipes': {
      const query = String(args['query'] ?? '').trim();
      if (!query) {
        return {
          ...text('What kind of recipe are you looking for?'),
          isError: true,
        };
      }
      const files = await listRecipeFiles(folderId, token);
      const rows = await ensureEmbeddings(user, files, token);
      const queryVector = await embedText(getEnv(), query);
      const matched = topSimilar(rows, queryVector, files, 8);
      return recipeListResult(
        matched,
        `Here are recipes matching "${query}".`,
        query,
      );
    }
    case 'find_similar': {
      const files = await listRecipeFiles(folderId, token);
      const file = matchFile(files, String(args['name'] ?? ''));
      if (!file) {
        return text(`No recipe found matching "${args['name']}".`);
      }
      const rows = await ensureEmbeddings(user, files, token);
      const self = rows.find((r) => r.drive_file_id === file.id);
      if (!self) {
        return text('Could not compute similarity for that recipe.');
      }
      const matched = topSimilar(
        rows,
        JSON.parse(self.vector) as number[],
        files,
        6,
        file.id,
      );
      return recipeListResult(
        matched,
        `Recipes similar to "${recipeDisplayName(file.name)}".`,
      );
    }
    case 'get_recipe': {
      const files = await listRecipeFiles(folderId, token);
      const file = matchFile(files, String(args['name'] ?? ''));
      if (!file) {
        return text(`No recipe found matching "${args['name']}".`);
      }
      const source = await getFileContent(file.id, token);
      return recipeCardResult(
        file.id,
        file.name,
        source,
        `Showing the "${recipeDisplayName(file.name)}" recipe.`,
        system,
      );
    }
    case 'import_recipe': {
      const content = String(args['content'] ?? '');
      if (!content.trim()) {
        return {
          ...text(
            'No page content provided. Fetch the page and pass its text/HTML as `content`.',
          ),
          isError: true,
        };
      }
      const sourceUrl = args['url'] ? String(args['url']) : undefined;
      const providedName = args['name'] ? String(args['name']) : undefined;
      const db = getDatabase();

      // Already imported this link? Return it instead of saving a duplicate.
      const existing = sourceUrl
        ? await findRecipeBySourceUrl(db, user.id, sourceUrl)
        : undefined;
      if (existing) {
        return recipeCardResult(
          existing.drive_file_id,
          existing.name,
          existing.source,
          `"${recipeDisplayName(existing.name)}" is already in your recipes.`,
          system,
        );
      }

      const converted = await convertImport(content, getEnv(), {
        sourceUrl,
        name: providedName,
      });
      if (!hasRecipeBody(converted)) {
        return {
          ...text(
            "That content didn't contain a recipe (no ingredients or steps), so nothing was saved. " +
              'Open the page, copy the actual recipe text, and call import_recipe again with it as `content`.',
          ),
          isError: true,
        };
      }
      const name =
        providedName ||
        parseRecipe(converted, 'recipe.cook').title ||
        'Imported Recipe';
      const cook = await tagCookSourceBestEffort(converted, name, getEnv());
      const file = await createRecipeFile(folderId, name, cook, token);
      await indexRecipeWrite(db, user.id, file.id, file.name, cook);
      return recipeCardResult(
        file.id,
        file.name,
        cook,
        `Imported "${recipeDisplayName(file.name)}".`,
        system,
      );
    }
    case 'add_recipe': {
      const dish = String(args['name'] ?? 'Untitled');
      const content = String(args['content'] ?? '');
      if (!content.trim()) {
        return { ...text('No recipe content provided.'), isError: true };
      }
      const tagged = await tagCookSourceBestEffort(content, dish, getEnv());
      const file = await createRecipeFile(folderId, dish, tagged, token);
      await indexRecipeWrite(
        getDatabase(),
        user.id,
        file.id,
        file.name,
        tagged,
      );
      return recipeCardResult(
        file.id,
        file.name,
        tagged,
        `Saved "${recipeDisplayName(file.name)}".`,
        system,
      );
    }
    case 'capture_idea': {
      const dish = String(args['name'] ?? 'Untitled');
      const filename = uncuratedFilename(dish);
      const body = buildStubSource({
        name: dish,
        prompt: String(args['prompt'] ?? ''),
        draft: args['draft'] ? String(args['draft']) : undefined,
      });
      const file = await createRecipeFile(folderId, filename, body, token);
      await indexRecipeWrite(getDatabase(), user.id, file.id, file.name, body);
      return recipeCardResult(
        file.id,
        file.name,
        body,
        `Saved "${dish}" as an idea to curate later.`,
        system,
      );
    }
    case 'log_cooking': {
      const files = await listRecipeFiles(folderId, token);
      const file = matchFile(files, String(args['recipe'] ?? ''));
      if (!file) {
        return text(`No recipe found matching "${args['recipe']}".`);
      }
      const source = await getFileContent(file.id, token);
      const updated = appendCookingLog(source, String(args['note'] ?? ''));
      await updateRecipeFile(file.id, updated, token);
      await indexRecipeWrite(
        getDatabase(),
        user.id,
        file.id,
        file.name,
        updated,
      );
      return recipeCardResult(
        file.id,
        file.name,
        updated,
        `Logged your note on "${recipeDisplayName(file.name)}".`,
        system,
      );
    }
    case 'favourite_recipe': {
      const files = await listRecipeFiles(folderId, token);
      const file = matchFile(files, String(args['recipe'] ?? ''));
      if (!file) {
        return text(`No recipe found matching "${args['recipe']}".`);
      }
      const on = args['favourite'] !== false;
      await setFavourite(getDatabase(), user.id, file.id, on);
      const label = recipeDisplayName(file.name);
      return text(
        on
          ? `Added "${label}" to your favourites.`
          : `Removed "${label}" from your favourites.`,
      );
    }
    case 'tag_recipe': {
      const files = await listRecipeFiles(folderId, token);
      const file = matchFile(files, String(args['recipe'] ?? ''));
      if (!file) {
        return text(`No recipe found matching "${args['recipe']}".`);
      }
      const original = await getFileContent(file.id, token);
      const { source: tagged, tags } = await tagCookSource(
        original,
        file.name,
        getEnv(),
      );
      // Also backfill a missing cover from the recipe's source page.
      const updated = await addMissingCover(tagged);
      if (tags.length === 0 && updated === original) {
        return text(
          `Couldn't confidently tag "${recipeDisplayName(file.name)}".`,
        );
      }
      await updateRecipeFile(file.id, updated, token);
      await indexRecipeWrite(
        getDatabase(),
        user.id,
        file.id,
        file.name,
        updated,
      );
      return recipeCardResult(
        file.id,
        file.name,
        updated,
        `Tagged "${recipeDisplayName(file.name)}".`,
        system,
      );
    }
    case 'annotate_recipe': {
      const files = await listRecipeFiles(folderId, token);
      const file = matchFile(files, String(args['recipe'] ?? ''));
      if (!file) {
        return text(`No recipe found matching "${args['recipe']}".`);
      }
      const noteText = String(args['note'] ?? '').trim();
      if (!noteText) {
        return { ...text('What note should I add?'), isError: true };
      }
      const ingredient = args['ingredient']
        ? String(args['ingredient']).trim()
        : '';
      const stepArg = args['step'];
      const scope: 'general' | 'ingredient' | 'step' = ingredient
        ? 'ingredient'
        : stepArg != null
          ? 'step'
          : 'general';
      const key =
        scope === 'ingredient'
          ? ingredient
          : scope === 'step'
            ? String(stepArg)
            : '';
      const source = await getFileContent(file.id, token);
      const updated = appendNote(source, { scope, key, text: noteText });
      await updateRecipeFile(file.id, updated, token);
      await indexRecipeWrite(
        getDatabase(),
        user.id,
        file.id,
        file.name,
        updated,
      );
      const where =
        scope === 'ingredient'
          ? ` on ${ingredient}`
          : scope === 'step'
            ? ` on step ${stepArg}`
            : '';
      return recipeCardResult(
        file.id,
        file.name,
        updated,
        `Added your note${where} to "${recipeDisplayName(file.name)}".`,
        system,
      );
    }
    default:
      return { ...text(`Unknown tool: ${name}`), isError: true };
  }
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which get an empty 202 from the route). Errors in a tool are
 * returned as a JSON-RPC error so the client surfaces them cleanly.
 */
export async function handleMcpMessage(
  user: User,
  message: JsonRpcMessage,
): Promise<object | null> {
  const id = message.id ?? null;
  try {
    switch (message.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: 'chowdown', version: '0.1.0' },
            instructions:
              "chowdown stores the user's cooking recipes as Cooklang files in their Google Drive. " +
              'IMPORTANT: this server never fetches URLs or browses the web. When the user gives a ' +
              'recipe link or web page, YOU open and read that page yourself, then call import_recipe ' +
              "and pass the page's RAW text or HTML as `content` — do NOT convert it to Cooklang " +
              'yourself; chowdown does the Cooklang conversion so the format stays consistent. Use ' +
              'add_recipe only for a recipe the user dictates directly as Cooklang, capture_idea for a ' +
              'vague wish with no full recipe yet, and log_cooking to record notes about a cook.',
          },
        };
      case 'notifications/initialized':
        return null;
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
      case 'tools/call':
        return {
          jsonrpc: '2.0',
          id,
          result: await callTool(user, message.params),
        };
      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: APP_RESOURCES.map((r) => ({
              uri: r.uri,
              name: r.name,
              description: r.description,
              mimeType: RESOURCE_MIME_TYPE,
              _meta: CARD_UI_META,
            })),
          },
        };
      case 'resources/read': {
        const uri = (message.params?.['uri'] as string | undefined) ?? '';
        const resource = APP_RESOURCES.find((r) => r.uri === uri);
        if (!resource) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Unknown resource: ${uri}` },
          };
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri: resource.uri,
                mimeType: RESOURCE_MIME_TYPE,
                text: resource.html,
                _meta: CARD_UI_META,
              },
            ],
          },
        };
      }
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        };
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
