/**
 * @packageDocumentation
 *
 * What each MCP tool does when an assistant calls it. A call arrives as a tool
 * name and untrusted JSON arguments. This module first checks the call against
 * the tool's own input schema (an unknown tool, or arguments that do not fit,
 * are refused as protocol errors before anything runs), then works on the
 * user's Drive and cached recipes and answers with a {@link ToolResult}.
 *
 * Every tool that touches recipe files goes through a {@link ToolContext}: the
 * signed-in user, their Drive access, and four small file operations. The other
 * things tools reach for (the database, AI models) are a {@link ToolServices}.
 * In production both are real; a test hands in fakes.
 *
 * A recipe that cannot be found, a failing Drive or model, and similar problems
 * the assistant can act on are answered as `isError` results with a message it
 * can relay. Only a mistake in this code escapes as an exception.
 */

import { getUserAccessToken } from '../auth/current-user';
import { DriveNotConnectedError } from '../auth/drive-access';
import type { User } from '../db/users';
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
import { importRecipe } from '../recipe/import-recipe';
import { resolveFile } from '../recipe/match';
import { validImageUrls, withImages } from '../recipe/media';
import { indexRecipeWrite } from '../recipe/tag-index';
import { parseVector, topSimilar } from '../recipe/similar';
import { isUnitSystem, type UnitSystem } from '../recipe/units';
import { SITE_URL } from '../site';
import { getDatabase } from '../util';
import { isJsonObject, validateJson } from './json-schema';
import {
  SCENARIO_TOOLS,
  runScenarioTool,
  type ScenarioToolName,
} from './scenarios';
import { textArg } from './tool-args';
import { toolNamed } from './tool-definitions';
import {
  BackendFailure,
  InvalidToolArguments,
  UnknownTool,
} from './tool-errors';
import {
  errorResult,
  recipeCardResult,
  recipeListResult,
  recipeListSummaryResult,
  textResult,
  type ToolResult,
} from './tool-results';
import {
  EMBEDDINGS_PER_CALL,
  guardFileOps,
  guarded,
  liveToolServices,
  type ToolServices,
} from './tool-services';

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

/** What a Drive-backed tool is: arguments, context and services in, a result out. */
type Handler = (
  args: Args,
  ctx: ToolContext,
  services: ToolServices,
) => Promise<ToolResult>;

/** How many close names to offer when a recipe is not found. */
const SUGGESTION_COUNT = 5;

/** A recipe as "Name (id: abc)", the way messages list the candidates. */
function candidate(file: DriveFile): string {
  return `${recipeDisplayName(file.name)} (id: ${file.id})`;
}

/**
 * Up to {@link SUGGESTION_COUNT} recipes whose names share a word (of three or
 * more letters) with what was asked for, so "No recipe found" can offer
 * something to try instead of a dead end.
 */
function closeNames(
  files: readonly DriveFile[],
  asked: string,
): readonly DriveFile[] {
  const words = foldText(asked)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
  return files
    .filter((file) => {
      const name = foldText(recipeDisplayName(file.name));
      return words.some((word) => name.includes(word));
    })
    .slice(0, SUGGESTION_COUNT);
}

/** The error for a recipe reference that matched no file. */
function notFound(files: readonly DriveFile[], asked: string): ToolResult {
  const near = closeNames(files, asked);
  return errorResult(
    `No recipe found matching "${asked.trim()}". ` +
      (near.length > 0
        ? `Recipes with similar names: ${near.map(candidate).join('; ')}.`
        : 'list_recipes shows every saved recipe and search_recipes finds one by name.'),
  );
}

/** The error for a write whose recipe reference fits several recipes. */
function ambiguous(
  asked: string,
  key: string,
  matches: readonly DriveFile[],
): ToolResult {
  const shown = matches.slice(0, SUGGESTION_COUNT);
  const more = matches.length - shown.length;
  return errorResult(
    `Several recipes match "${asked.trim()}", so nothing was changed: ${shown.map(candidate).join('; ')}${more > 0 ? `; and ${more} more` : ''}. ` +
      `Call again with the id of the one you mean as \`${key}\`.`,
  );
}

/**
 * Open the user's Drive: a fresh access token and the Recipes folder (made on
 * first use), wrapped in the file operations the tools use.
 */
export async function createToolContext(
  user: Readonly<User>,
): Promise<ToolContext> {
  const token = await guarded('Google Drive', () => getUserAccessToken(user));
  const folderId =
    user.recipes_folder_id ??
    (await guarded('Google Drive', () => ensureRecipesFolder(token)));
  const units = user.units ?? '';
  return {
    user,
    token,
    system: isUnitSystem(units) ? units : undefined,
    files: guardFileOps({
      list: () => listRecipeFiles(folderId, token),
      read: (fileId) => getFileContent(fileId, token),
      create: (name, content) =>
        createRecipeFile(folderId, name, content, token),
      update: (fileId, content) => updateRecipeFile(fileId, content, token),
      index: (fileId, name, source) =>
        indexRecipeWrite(getDatabase(), user.id, fileId, name, source),
    }),
  };
}

/** Whether a tool reads a recipe or is about to change it. */
type Intent = 'read' | 'write';

/**
 * Find the recipe an argument names among `files` and run `then` on it, or
 * answer why not. A reference that fits no recipe is an error that offers close
 * names. One that fits several recipes is an error too when the tool is about
 * to change one (`write`: it must not guess which file to edit), listing the
 * candidates with their ids; a tool that only reads (`read`) shows the best
 * match and is told the other candidates, so it can say so.
 *
 * @param key The argument the reference came from, for the message.
 */
async function withRecipeIn(
  files: readonly DriveFile[],
  asked: unknown,
  key: string,
  intent: Intent,
  then: (
    file: DriveFile,
    alsoMatching: readonly DriveFile[],
  ) => Promise<ToolResult>,
): Promise<ToolResult> {
  const reference = textArg(asked);
  const match = resolveFile(files, reference);
  switch (match.kind) {
    case 'none':
      return notFound(files, reference);
    case 'one':
      return then(match.file, []);
    case 'many': {
      const [best, ...others] = match.files;
      return intent === 'read'
        ? then(best, others)
        : ambiguous(reference, key, match.files);
    }
  }
}

/** {@link withRecipeIn} on the files in the user's Recipes folder. */
async function withRecipe(
  ctx: ToolContext,
  asked: unknown,
  key: string,
  intent: Intent,
  then: (
    file: DriveFile,
    alsoMatching: readonly DriveFile[],
  ) => Promise<ToolResult>,
): Promise<ToolResult> {
  return withRecipeIn(await ctx.files.list(), asked, key, intent, then);
}

/** A sentence naming the other recipes a name also fits, or nothing if there are none. */
function alsoMatchingNote(
  asked: unknown,
  others: readonly DriveFile[],
): string {
  return others.length > 0
    ? ` "${textArg(asked).trim()}" also matches ${others.slice(0, SUGGESTION_COUNT).map(candidate).join('; ')}; use an id to choose.`
    : '';
}

/** A sentence saying some recipes are not searchable yet, or nothing if all are. */
function indexingNote(waiting: number): string {
  return waiting > 0
    ? ` ${countOf(waiting, 'recipe')} not searchable yet: at most ${EMBEDDINGS_PER_CALL} new or edited recipes are indexed per search, so these results may be incomplete. Search again to include more.`
    : '';
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
const findRecipes: Handler = async (args, ctx, services) => {
  const query = textArg(args['query']).trim();
  const files = await ctx.files.list();
  const { rows, waiting } = await services.searchIndex(
    ctx.user,
    files,
    ctx.token,
  );
  const queryVector = await services.embedQuery(query);
  return recipeListResult(
    topSimilar(rows, queryVector, files, 8),
    `Here are recipes matching "${query}".${indexingNote(waiting)}`,
    query,
  );
};

/** `find_similar`: the saved recipes closest to a named one. */
const findSimilar: Handler = async (args, ctx, services) => {
  const files = await ctx.files.list();
  return withRecipeIn(files, args['name'], 'name', 'read', async (file) => {
    const { rows, waiting } = await services.searchIndex(
      ctx.user,
      files,
      ctx.token,
      file.id,
    );
    const self = rows.find((r) => r.drive_file_id === file.id);
    if (!self) {
      return errorResult('Could not compute similarity for that recipe.');
    }
    return recipeListResult(
      topSimilar(rows, parseVector(self.vector), files, 6, file.id),
      `Recipes similar to "${recipeDisplayName(file.name)}".${indexingNote(waiting)}`,
    );
  });
};

/** `get_recipe`: one recipe, as a card. */
const getRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['name'], 'name', 'read', async (file, others) =>
    recipeCardResult(
      file.id,
      file.name,
      await ctx.files.read(file.id),
      `Showing the "${recipeDisplayName(file.name)}" recipe.${alsoMatchingNote(args['name'], others)}`,
      ctx.system,
    ),
  );

/** `import_recipe`: turn a web page's content into a saved recipe. */
const importRecipeTool: Handler = async (args, ctx, services) => {
  const content = textArg(args['content']);
  const outcome = await importRecipe(
    {
      findExisting: (url) => services.findImported(ctx.user.id, url),
      convert: services.convertImport,
      tag: services.tagBestEffort,
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
const addRecipe: Handler = async (args, ctx, services) => {
  const dish = textArg(args['name']);
  const tagged = await services.tagBestEffort(textArg(args['content']), dish);
  return createAndShow(
    ctx,
    dish,
    tagged,
    (file) => `Saved "${recipeDisplayName(file.name)}".`,
  );
};

/** `capture_idea`: keep a vague wish as an uncurated stub to turn into a recipe later. */
const captureIdea: Handler = async (args, ctx) => {
  const dish = textArg(args['name']);
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
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) =>
    saveAndShow(
      ctx,
      file,
      appendCookingLog(await ctx.files.read(file.id), textArg(args['note'])),
      `Logged your note on "${recipeDisplayName(file.name)}".`,
    ),
  );

/** `favourite_recipe`: heart a recipe, or take the heart off. */
const favouriteRecipe: Handler = (args, ctx, services) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
    const on = args['favourite'] !== false;
    await services.setFavourite(ctx.user.id, file.id, on);
    const label = recipeDisplayName(file.name);
    return textResult(
      on
        ? `Added "${label}" to your favourites.`
        : `Removed "${label}" from your favourites.`,
    );
  });

/** `tag_recipe`: classify a recipe and write the tags (and a missing cover) onto it. */
const tagRecipe: Handler = (args, ctx, services) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
    const original = await ctx.files.read(file.id);
    const { source: tagged, tags } = await services.tag(original, file.name);
    // Also backfill a missing cover from the recipe's source page.
    const updated = await services.addCover(tagged);
    if (tags.length === 0 && updated === original) {
      return errorResult(
        `Couldn't confidently tag "${recipeDisplayName(file.name)}", so nothing was changed.`,
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
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
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
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
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
function isDriveTool(name: string): name is DriveToolName {
  return Object.hasOwn(DRIVE_TOOLS, name);
}

/** `set_measurement_system`: remember metric, us or imperial for this user. */
async function setMeasurementSystem(
  user: Readonly<User>,
  args: Args,
  services: ToolServices,
): Promise<ToolResult> {
  const system = textArg(args['system']).toLowerCase();
  if (!isUnitSystem(system)) {
    return errorResult('Please choose metric, us, or imperial.');
  }
  await services.setUnits(user.id, system);
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
  services: ToolServices,
): Promise<ToolResult> {
  const result = await runScenarioTool(tool, args, services.scenario(user));
  if (result.isError) {
    return errorResult(result.message);
  }
  if (result.plain) {
    return textResult(result.message);
  }
  return recipeListSummaryResult(
    result.recipes.map((r) => ({ id: r.id, name: r.filename })),
    result.message,
  );
}

/**
 * The arguments of a call, checked against the tool's input schema.
 *
 * @throws {InvalidToolArguments} If `arguments` is not an object or does not fit
 *   the schema (missing or unknown properties, wrong types, values out of range).
 */
function checkedArguments(
  schema: Parameters<typeof validateJson>[0],
  rawArgs: unknown,
): Args {
  // Omitted arguments count as none, so the schema can say what is required.
  const args = rawArgs === undefined ? {} : rawArgs;
  if (!isJsonObject(args)) {
    throw new InvalidToolArguments(['`arguments` must be an object.']);
  }
  const problems = validateJson(schema, args, 'The arguments');
  if (problems.length > 0) {
    throw new InvalidToolArguments(problems);
  }
  return args;
}

/**
 * Execute a `tools/call` for `user`.
 *
 * @param openContext How Drive is opened; tests pass a fake.
 * @param services The database, AI and page fetching; tests pass fakes.
 * @throws {UnknownTool} If no such tool exists.
 * @throws {InvalidToolArguments} If the arguments do not fit the tool's schema.
 *   Both are checked before Drive is opened or anything runs.
 * @throws {DriveNotConnectedError} If the tool needs Drive and it is not
 *   connected.
 * @throws {BackendFailure} If Drive, the database or a model failed mid-call.
 */
export async function callTool(
  user: Readonly<User>,
  params: Args | undefined,
  openContext: (
    user: Readonly<User>,
  ) => Promise<ToolContext> = createToolContext,
  services: ToolServices = liveToolServices,
): Promise<ToolResult> {
  const name: unknown = params?.['name'];
  if (typeof name !== 'string' || name === '') {
    throw new InvalidToolArguments(['`name` must be the name of a tool.']);
  }
  const tool = toolNamed(name);
  if (!tool) {
    throw new UnknownTool(name);
  }
  const args = checkedArguments(tool.inputSchema, params?.['arguments']);

  // set_measurement_system just records a preference — handle it before the
  // Drive round-trip the recipe tools need.
  if (name === 'set_measurement_system') {
    return setMeasurementSystem(user, args, services);
  }

  // The question-shaped tools read the D1 cache, so they skip Drive.
  const scenario = SCENARIO_TOOLS.find((t) => t === name);
  if (scenario) {
    return runScenario(user, scenario, args, services);
  }

  if (!isDriveTool(name)) {
    // Advertised but not implemented: a bug here, not something to tell the caller.
    throw new Error(`Tool ${name} is listed but has no implementation.`);
  }
  return DRIVE_TOOLS[name](args, await openContext(user), services);
}

/**
 * Run a `tools/call`. Someone who has signed in but not yet connected their
 * Google Drive has no recipes for the assistant to reach, and Drive, the
 * database or a model can fail mid-call; both are explained in words the
 * assistant can pass on, as a tool error, instead of a protocol error. An
 * unknown tool or arguments that do not fit are still thrown for the router to
 * answer as a protocol error.
 *
 * @param openContext How Drive is opened; leave out for the real one.
 * @param services The database, AI and page fetching; leave out for the real ones.
 */
export async function callToolOrExplain(
  user: Readonly<User>,
  params: Args | undefined,
  openContext?: (user: Readonly<User>) => Promise<ToolContext>,
  services?: ToolServices,
): Promise<ToolResult> {
  try {
    return await callTool(user, params, openContext, services);
  } catch (error) {
    if (error instanceof DriveNotConnectedError) {
      return errorResult(
        `Google Drive isn't connected to chowdown yet, so there are no recipes to reach. Ask the user to open ${SITE_URL}/app, choose "Connect Google Drive", and then try again.`,
      );
    }
    if (error instanceof BackendFailure) {
      // What actually failed stays in our logs; it can hold Google's replies or
      // database details that should not travel on to an assistant.
      console.error(`[mcp] ${error.service} failed:`, error.cause);
      return errorResult(
        `Something went wrong with ${error.service}, so that did not work. Try again in a minute; if it keeps failing, tell the user.`,
      );
    }
    throw error;
  }
}
