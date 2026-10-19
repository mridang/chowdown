/**
 * @packageDocumentation
 *
 * What each MCP tool does when an assistant calls it. A call arrives as a tool
 * name and loosely typed arguments; this module reads the arguments, works on
 * the user's Drive and cached recipes, and answers with a {@link ToolResult}.
 *
 * Every tool that touches recipe files goes through a {@link ToolContext}: the
 * signed-in user, their Drive access, and four small file operations. In
 * production those are the real Drive and database; a test hands in fakes.
 */

import { getUserAccessToken } from '../auth/current-user';
import { DriveNotConnectedError } from '../auth/drive-access';
import { findRecipeBySourceUrl, listRecipesByUser } from '../db/recipes';
import { listFavouriteIds } from '../db/favourites';
import { setUserUnits, type User } from '../db/users';
import {
  createRecipeFile,
  ensureRecipesFolder,
  getFileContent,
  listRecipeFiles,
  updateRecipeFile,
  type DriveFile,
} from '../drive/drive-client';
import { countOf, foldText } from '../intl';
import {
  appendCookingLog,
  appendNote,
  buildStubSource,
  recipeDisplayName,
  removeMetadata,
  uncuratedFilename,
} from '../recipe/cook-text';
import { syncFromDrive } from '../recipe/drive-sync';
import { embedText } from '../recipe/embeddings';
import { setFavouriteAndTag } from '../recipe/favourite';
import { importRecipe } from '../recipe/import-recipe';
import { matchFile } from '../recipe/match';
import { validImageUrls, withImages } from '../recipe/media';
import { ensureEmbeddings, parseVector, topSimilar } from '../recipe/similar';
import { indexRecipeWrite } from '../recipe/tag-index';
import { tagCookSource, tagCookSourceBestEffort } from '../recipe/tagging';
import { addMissingCover, convertImport } from '../recipe/to-cooklang';
import { isUnitSystem, type UnitSystem } from '../recipe/units';
import { SITE_URL } from '../site';
import { getDatabase, getEnv, runInBackground } from '../util';
import {
  SCENARIO_TOOLS,
  runScenarioTool,
  type ScenarioToolName,
} from './scenarios';
import { textArg } from './tool-args';
import {
  errorResult,
  recipeCardResult,
  recipeListResult,
  textResult,
  type ToolResult,
} from './tool-results';

/** The four things the tools do with recipe files, plus the cache refresh that follows a write. */
export interface FileOps {
  /** Every recipe file in the user's Recipes folder. */
  readonly list: () => Promise<readonly DriveFile[]>;
  /** A file's text. */
  readonly read: (fileId: string) => Promise<string>;
  /** Save a new recipe file. */
  readonly create: (name: string, content: string) => Promise<DriveFile>;
  /** Replace a file's text. */
  readonly update: (fileId: string, content: string) => Promise<void>;
  /** Refresh the cached copy of a recipe that was just written. */
  readonly index: (
    fileId: string,
    name: string,
    source: string,
  ) => Promise<void>;
}

/** Everything a Drive-backed tool needs. */
export interface ToolContext {
  readonly user: Readonly<User>;
  /** A fresh Drive access token for the user. */
  readonly token: string;
  /** The user's preferred measurement system, applied to every recipe card. */
  readonly system: UnitSystem | undefined;
  readonly files: FileOps;
}

/** The arguments of a tool call. */
type Args = Readonly<Record<string, unknown>>;

/** What a Drive-backed tool is: arguments and context in, a result out. */
type Handler = (args: Args, ctx: ToolContext) => Promise<ToolResult>;

/** Whether a value is a JSON object (or array) whose members can be looked up by name. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** The sentence for a recipe name that matched no file. */
function noRecipeMatching(asked: unknown): string {
  return `No recipe found matching "${String(asked)}".`;
}

/**
 * Open the user's Drive: a fresh access token and the Recipes folder (made on
 * first use), wrapped in the file operations the tools use.
 */
async function createToolContext(user: Readonly<User>): Promise<ToolContext> {
  const token = await getUserAccessToken(user);
  const folderId = user.recipes_folder_id ?? (await ensureRecipesFolder(token));
  const units = user.units ?? '';
  return {
    user,
    token,
    system: isUnitSystem(units) ? units : undefined,
    files: {
      list: () => listRecipeFiles(folderId, token),
      read: (fileId) => getFileContent(fileId, token),
      create: (name, content) =>
        createRecipeFile(folderId, name, content, token),
      update: (fileId, content) => updateRecipeFile(fileId, content, token),
      index: (fileId, name, source) =>
        indexRecipeWrite(getDatabase(), user.id, fileId, name, source),
    },
  };
}

/**
 * Find the recipe an argument names and run `then` on it, or answer that
 * nothing matches.
 */
async function withRecipe(
  ctx: ToolContext,
  asked: unknown,
  then: (file: DriveFile) => Promise<ToolResult>,
): Promise<ToolResult> {
  const file = matchFile(await ctx.files.list(), textArg(asked));
  return file ? then(file) : textResult(noRecipeMatching(asked));
}

/** Save `updated` over a recipe, refresh its cached copy, and show it as a card. */
async function saveAndShow(
  ctx: ToolContext,
  file: DriveFile,
  updated: string,
  message: string,
): Promise<ToolResult> {
  await ctx.files.update(file.id, updated);
  await ctx.files.index(file.id, file.name, updated);
  return recipeCardResult(file.id, file.name, updated, message, ctx.system);
}

/** Make a new recipe file, cache it, and show it as a card. */
async function createAndShow(
  ctx: ToolContext,
  name: string,
  content: string,
  messageFor: (file: DriveFile) => string,
): Promise<ToolResult> {
  const file = await ctx.files.create(name, content);
  await ctx.files.index(file.id, file.name, content);
  return recipeCardResult(
    file.id,
    file.name,
    content,
    messageFor(file),
    ctx.system,
  );
}

/** `list_recipes`: the names of every saved recipe. */
const listRecipes: Handler = async (_args, ctx) => {
  const files = await ctx.files.list();
  return recipeListResult(
    files,
    files.length ? `Showing your ${files.length} recipes.` : 'No recipes yet.',
  );
};

/** `search_recipes`: recipes whose name contains the query, accents and case ignored. */
const searchRecipes: Handler = async (args, ctx) => {
  const queryRaw = textArg(args['query']);
  const query = foldText(queryRaw);
  const hits = (await ctx.files.list()).filter((f) =>
    foldText(recipeDisplayName(f.name)).includes(query),
  );
  return recipeListResult(
    hits,
    hits.length
      ? `Found ${countOf(hits.length, 'recipe')} matching "${queryRaw}".`
      : `No recipes match "${queryRaw}".`,
    queryRaw,
  );
};

/** `find_recipes`: semantic search by what the recipes are about. */
const findRecipes: Handler = async (args, ctx) => {
  const query = textArg(args['query']).trim();
  if (!query) {
    return errorResult('What kind of recipe are you looking for?');
  }
  const files = await ctx.files.list();
  const rows = await ensureEmbeddings(ctx.user, files, ctx.token);
  const queryVector = await embedText(getEnv(), query);
  return recipeListResult(
    topSimilar(rows, queryVector, files, 8),
    `Here are recipes matching "${query}".`,
    query,
  );
};

/** `find_similar`: the saved recipes closest to a named one. */
const findSimilar: Handler = async (args, ctx) => {
  const files = await ctx.files.list();
  const file = matchFile(files, textArg(args['name']));
  if (!file) {
    return textResult(noRecipeMatching(args['name']));
  }
  const rows = await ensureEmbeddings(ctx.user, files, ctx.token);
  const self = rows.find((r) => r.drive_file_id === file.id);
  if (!self) {
    return textResult('Could not compute similarity for that recipe.');
  }
  return recipeListResult(
    topSimilar(rows, parseVector(self.vector), files, 6, file.id),
    `Recipes similar to "${recipeDisplayName(file.name)}".`,
  );
};

/** `get_recipe`: one recipe, as a card. */
const getRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['name'], async (file) =>
    recipeCardResult(
      file.id,
      file.name,
      await ctx.files.read(file.id),
      `Showing the "${recipeDisplayName(file.name)}" recipe.`,
      ctx.system,
    ),
  );

/** `import_recipe`: turn a web page's content into a saved recipe. */
const importRecipeTool: Handler = async (args, ctx) => {
  const content = textArg(args['content']);
  if (!content.trim()) {
    return errorResult(
      'No page content provided. Fetch the page and pass its text/HTML as `content`.',
    );
  }
  const env = getEnv();
  const outcome = await importRecipe(
    {
      findExisting: async (url) => {
        const row = await findRecipeBySourceUrl(
          getDatabase(),
          ctx.user.id,
          url,
        );
        return row
          ? { id: row.drive_file_id, name: row.name, source: row.source }
          : undefined;
      },
      convert: (c, opts) => convertImport(c, env, opts),
      tag: (src, name) => tagCookSourceBestEffort(src, name, env),
      create: ctx.files.create,
      update: ctx.files.update,
      index: ctx.files.index,
    },
    {
      content,
      url: args['url'] ? textArg(args['url']) : undefined,
      name: args['name'] ? textArg(args['name']) : undefined,
      images: Array.isArray(args['images'])
        ? args['images'].map(String)
        : undefined,
    },
  );
  if (outcome.kind === 'refused') {
    return errorResult(
      "That content didn't contain a recipe (no ingredients or steps), so nothing was saved. " +
        'Open the page, copy the actual recipe text, and call import_recipe again with it as `content`.',
    );
  }
  const label = recipeDisplayName(outcome.name);
  const message =
    outcome.kind === 'existing'
      ? `"${label}" is already in your recipes.`
      : outcome.kind === 'repaired'
        ? `Repaired "${label}" — the earlier import had no ingredients or steps.`
        : `Imported "${label}".`;
  return recipeCardResult(
    outcome.id,
    outcome.name,
    outcome.source,
    message,
    ctx.system,
  );
};

/** `add_recipe`: save a recipe the assistant already wrote as Cooklang. */
const addRecipe: Handler = async (args, ctx) => {
  const dish = textArg(args['name'] ?? 'Untitled');
  const content = textArg(args['content']);
  if (!content.trim()) {
    return errorResult('No recipe content provided.');
  }
  const tagged = await tagCookSourceBestEffort(content, dish, getEnv());
  return createAndShow(
    ctx,
    dish,
    tagged,
    (file) => `Saved "${recipeDisplayName(file.name)}".`,
  );
};

/** `capture_idea`: keep a vague wish as an uncurated stub to turn into a recipe later. */
const captureIdea: Handler = async (args, ctx) => {
  const dish = textArg(args['name'] ?? 'Untitled');
  const body = buildStubSource({
    name: dish,
    prompt: textArg(args['prompt']),
    draft: args['draft'] ? textArg(args['draft']) : undefined,
  });
  return createAndShow(
    ctx,
    uncuratedFilename(dish),
    body,
    () => `Saved "${dish}" as an idea to curate later.`,
  );
};

/** `log_cooking`: add a dated note about a time the recipe was cooked. */
const logCooking: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], async (file) =>
    saveAndShow(
      ctx,
      file,
      appendCookingLog(await ctx.files.read(file.id), textArg(args['note'])),
      `Logged your note on "${recipeDisplayName(file.name)}".`,
    ),
  );

/** `favourite_recipe`: heart a recipe, or take the heart off. */
const favouriteRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], async (file) => {
    const on = args['favourite'] !== false;
    await setFavouriteAndTag(ctx.user.id, file.id, on);
    const label = recipeDisplayName(file.name);
    return textResult(
      on
        ? `Added "${label}" to your favourites.`
        : `Removed "${label}" from your favourites.`,
    );
  });

/** `tag_recipe`: classify a recipe and write the tags (and a missing cover) onto it. */
const tagRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], async (file) => {
    const original = await ctx.files.read(file.id);
    const { source: tagged, tags } = await tagCookSource(
      original,
      file.name,
      getEnv(),
    );
    // Also backfill a missing cover from the recipe's source page.
    const updated = await addMissingCover(tagged);
    if (tags.length === 0 && updated === original) {
      return textResult(
        `Couldn't confidently tag "${recipeDisplayName(file.name)}".`,
      );
    }
    return saveAndShow(
      ctx,
      file,
      updated,
      `Tagged "${recipeDisplayName(file.name)}".`,
    );
  });

/** `set_recipe_images`: set the cover and extra photos of a recipe, or remove them. */
const setRecipeImages: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], async (file) => {
    const urls = Array.isArray(args['images'])
      ? args['images'].map(String)
      : [];
    const clear = args['clear'] === true;
    if (!clear && validImageUrls(urls).length === 0) {
      return errorResult('Pass at least one http(s) image URL in `images`.');
    }
    const original = await ctx.files.read(file.id);
    const label = recipeDisplayName(file.name);
    return saveAndShow(
      ctx,
      file,
      clear ? removeMetadata(original, 'images') : withImages(original, urls),
      clear
        ? `Removed the images from "${label}".`
        : `Set the cover for "${label}".`,
    );
  });

/** Where a personal note attaches: an ingredient, a step, or the recipe as a whole. */
interface NoteTarget {
  readonly scope: 'general' | 'ingredient' | 'step';
  /** The ingredient name or step number; empty for a general note. */
  readonly key: string;
  /** How the confirmation sentence says where the note went. */
  readonly where: string;
}

/** Work out where an `annotate_recipe` call wants its note: an ingredient wins over a step. */
export function noteTarget(args: Args): NoteTarget {
  const ingredient = args['ingredient']
    ? textArg(args['ingredient']).trim()
    : '';
  const step = args['step'];
  if (ingredient) {
    return { scope: 'ingredient', key: ingredient, where: ` on ${ingredient}` };
  }
  return step != null
    ? { scope: 'step', key: String(step), where: ` on step ${String(step)}` }
    : { scope: 'general', key: '', where: '' };
}

/** `annotate_recipe`: add a personal note without changing the original recipe. */
const annotateRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], async (file) => {
    const noteText = textArg(args['note']).trim();
    if (!noteText) {
      return errorResult('What note should I add?');
    }
    const { scope, key, where } = noteTarget(args);
    const updated = appendNote(await ctx.files.read(file.id), {
      scope,
      key,
      text: noteText,
    });
    return saveAndShow(
      ctx,
      file,
      updated,
      `Added your note${where} to "${recipeDisplayName(file.name)}".`,
    );
  });

/** The tools that work on the user's Drive files, by name. */
const DRIVE_TOOLS = {
  list_recipes: listRecipes,
  search_recipes: searchRecipes,
  find_recipes: findRecipes,
  find_similar: findSimilar,
  get_recipe: getRecipe,
  import_recipe: importRecipeTool,
  add_recipe: addRecipe,
  capture_idea: captureIdea,
  log_cooking: logCooking,
  favourite_recipe: favouriteRecipe,
  tag_recipe: tagRecipe,
  set_recipe_images: setRecipeImages,
  annotate_recipe: annotateRecipe,
} as const satisfies Record<string, Handler>;

/** One of the Drive-backed tool names. */
type DriveToolName = keyof typeof DRIVE_TOOLS;

/** Whether a name belongs to a Drive-backed tool. */
function isDriveTool(name: unknown): name is DriveToolName {
  return typeof name === 'string' && Object.hasOwn(DRIVE_TOOLS, name);
}

/** `set_measurement_system`: remember metric, us or imperial for this user. */
async function setMeasurementSystem(
  user: Readonly<User>,
  args: Args,
): Promise<ToolResult> {
  const system = textArg(args['system']).toLowerCase();
  if (!isUnitSystem(system)) {
    return errorResult('Please choose metric, us, or imperial.');
  }
  await setUserUnits(getDatabase(), user.id, system);
  return textResult(`Done — I'll show recipes in ${system} units from now on.`);
}

/**
 * Run a question-shaped tool. They read the D1 cache, so they never touch
 * Drive unless the cache is empty and has to be filled.
 */
async function runScenario(
  user: Readonly<User>,
  tool: ScenarioToolName,
  args: Args,
): Promise<ToolResult> {
  const db = getDatabase();
  const result = await runScenarioTool(tool, args, {
    rows: () => listRecipesByUser(db, user.id),
    favouriteIds: () => listFavouriteIds(db, user.id),
    sync: () => syncFromDrive(user),
    inBackground: runInBackground,
  });
  if (result.isError) {
    return errorResult(result.message);
  }
  if (result.plain) {
    return textResult(result.message);
  }
  return recipeListResult(
    result.recipes.map((r) => ({ id: r.id, name: r.filename })),
    result.message,
  );
}

/**
 * Execute a `tools/call` for `user`. Throws {@link DriveNotConnectedError} if
 * the tool needs Drive and it is not connected. `openContext` is how Drive is
 * opened; tests pass a fake.
 */
export async function callTool(
  user: Readonly<User>,
  params: Args | undefined,
  openContext: (
    user: Readonly<User>,
  ) => Promise<ToolContext> = createToolContext,
): Promise<ToolResult> {
  const name: unknown = params?.['name'];
  const rawArgs: unknown = params?.['arguments'];
  const args: Args = isRecord(rawArgs) ? rawArgs : {};

  // set_measurement_system just records a preference — handle it before the
  // Drive round-trip the recipe tools need.
  if (name === 'set_measurement_system') {
    return setMeasurementSystem(user, args);
  }

  // The question-shaped tools read the D1 cache, so they skip Drive.
  const scenario = SCENARIO_TOOLS.find((t) => t === name);
  if (scenario) {
    return runScenario(user, scenario, args);
  }

  // Drive is opened before the name is looked up, so someone with no Drive
  // connection is told so even when the tool name is wrong.
  const ctx = await openContext(user);
  return isDriveTool(name)
    ? DRIVE_TOOLS[name](args, ctx)
    : errorResult(`Unknown tool: ${String(name)}`);
}

/**
 * Run a `tools/call`. Someone who has signed in but not yet connected their
 * Google Drive has no recipes for the assistant to reach; say so in words the
 * assistant can pass on, instead of a protocol error.
 */
export async function callToolOrExplain(
  user: Readonly<User>,
  params: Args | undefined,
): Promise<ToolResult> {
  try {
    return await callTool(user, params);
  } catch (error) {
    if (error instanceof DriveNotConnectedError) {
      return errorResult(
        `Google Drive isn't connected to chowdown yet, so there are no recipes to reach. Ask the user to open ${SITE_URL}/app, choose "Connect Google Drive", and then try again.`,
      );
    }
    throw error;
  }
}
