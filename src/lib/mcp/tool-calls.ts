/**
 * @packageDocumentation
 *
 * What each MCP tool does when an assistant calls it. A call arrives as a tool
 * name and untrusted JSON arguments. This module first checks the call against
 * the tool's own input schema before anything runs, then works on the user's
 * Drive and cached recipes and answers with a {@link ToolResult}. A call that
 * names no such tool, or whose envelope is malformed, is a protocol error; a
 * call whose arguments do not fit the schema is a mistake the assistant can fix
 * and is answered as an `isError` result that says how (the MCP spec files input
 * validation under tool execution errors, so that a host shows the model what
 * to correct).
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

import { getUserAccessToken } from '../auth/user-access-token';
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
import { parseRecipe } from '../recipe/cooklang';
import { importRecipe } from '../recipe/import-recipe';
import { resolveFile } from '../recipe/match';
import { validImageUrls, withImages } from '../recipe/media';
import { indexRecipeWrite } from '../recipe/tag-index';
import { parseVector, topSimilar } from '../recipe/similar';
import { isUnitSystem, type UnitSystem } from '../recipe/units';
import { SITE_URL } from '../site';
import { errorMessage, getDatabase, logError } from '../util';
import { isJsonObject, validateJson, type JsonSchema } from './json-schema';
import {
  SCENARIO_TOOLS,
  runScenarioTool,
  type ScenarioToolName,
} from './scenarios';
import { canonicalArguments, numberArg, offsetArg, textArg } from './tool-args';
import { PAGE_DEFAULT, PAGE_MAX, toolNamed } from './tool-definitions';
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
import { nextPageHint, pastTheEnd, plainTitle, rangeText } from './tool-text';
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

/**
 * A recipe's name as a sentence quotes it. Names are other people's words (a
 * file name in Drive, a title from an imported page), so they are flattened to
 * one line first (see {@link plainTitle}).
 */
function label(file: DriveFile): string {
  return plainTitle(recipeDisplayName(file.name));
}

/** A recipe as "Name (id: abc)", the way messages list the candidates. */
function candidate(file: DriveFile): string {
  return `${label(file)} (id: ${file.id})`;
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

/** The tools that call a model on the person's behalf, and so spend their daily allowance. */
const MODEL_TOOLS: ReadonlySet<string> = new Set([
  'import_recipe',
  'add_recipe',
  'tag_recipe',
]);

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

/** What an edit to a recipe's text decides: the new text, or an answer to give instead of saving. */
type Edited = { readonly text: string } | { readonly refusal: ToolResult };

/** How many times an edit is worked out afresh when the file changes under it. */
const EDIT_ATTEMPTS = 5;

/** How often each line occurs in a text, for telling what an edit added. */
function lineCounts(text: string): ReadonlyMap<string, number> {
  return new Map(
    [...Map.groupBy(text.split('\n'), (line) => line)].map(([line, same]) => [
      line,
      same.length,
    ]),
  );
}

/**
 * Whether what an edit added is still in the file after it was written. `written`
 * is `current` plus the edit; `latest` is what the file holds now. Every line the
 * edit added must be there as often as `written` has it, which is the case when
 * nobody else wrote in between, and when somebody did but built on our text. If
 * somebody wrote from the text we started from, their save replaced ours and the
 * lines are missing.
 */
function editSurvived(
  current: string,
  written: string,
  latest: string,
): boolean {
  const before = lineCounts(current);
  const now = lineCounts(latest);
  return [...lineCounts(written)].every(
    ([line, count]) =>
      count <= (before.get(line) ?? 0) || (now.get(line) ?? 0) >= count,
  );
}

/**
 * Change a recipe's text and show the result as a card.
 *
 * Every write tool is a read, a change to the text and a write of the whole
 * file, and Drive cannot write "only if unchanged", so two edits that overlap
 * (assistants routinely issue several tool calls at once) would lose one of them.
 * Without a lock to take, this checks twice and redoes the edit when either check
 * fails, so that an edit is not lost without anyone knowing:
 *
 * - just before writing, the file is read again; if it is no longer what the edit
 *   was worked out from, the edit is worked out again from the new text;
 * - just after writing, it is read once more; if the lines the edit added are not
 *   there, another save replaced ours, and the edit is worked out again from
 *   what the file holds now. The other save notices the same if it was the one
 *   replaced, so two overlapping edits end with both in the file.
 *
 * It gives up after {@link EDIT_ATTEMPTS} tries with an error that says the
 * outcome is not certain. This narrows the window for losing an edit to the
 * moments between a check and the write that follows it, and does not close it;
 * Drive offers nothing that could.
 *
 * @param edit Works out the new text from the current text, or refuses (an
 *   answer to return as it is, with nothing written). It may be run more than
 *   once, so it must not have effects of its own.
 * @param message The sentence that goes with the card.
 */
async function editRecipe(
  ctx: ToolContext,
  file: DriveFile,
  edit: (current: string) => Promise<Edited> | Edited,
  message: string,
): Promise<ToolResult> {
  const attempt = async (left: number): Promise<ToolResult> => {
    if (left === 0) {
      return errorResult(
        `"${label(file)}" was being changed somewhere else while this edit was made, so it is not certain it was saved. Look at the recipe, and make the change again if it is missing.`,
      );
    }
    const current = await ctx.files.read(file.id);
    const edited = await edit(current);
    if ('refusal' in edited) {
      return edited.refusal;
    }
    if ((await ctx.files.read(file.id)) !== current) {
      return attempt(left - 1);
    }
    await ctx.files.update(file.id, edited.text);
    const latest = await ctx.files.read(file.id);
    if (!editSurvived(current, edited.text, latest)) {
      return attempt(left - 1);
    }
    await ctx.files.index(file.id, file.name, latest);
    return recipeCardResult(file.id, file.name, latest, message, ctx.system);
  };
  return attempt(EDIT_ATTEMPTS);
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

/** A page of a long list: where it starts and how many it may hold. */
interface PageWindow {
  readonly offset: number;
  readonly limit: number;
}

/** The page the `limit` and `offset` arguments ask for, with `limit` kept to 1..`max`. */
function pageWindow(args: Args, fallback: number, max: number): PageWindow {
  const limit = Math.floor(numberArg(args['limit']) ?? fallback);
  return {
    offset: offsetArg(args['offset']),
    limit: Math.min(Math.max(limit, 1), max),
  };
}

/** `list_recipes`: the saved recipes, a page at a time. */
const listRecipes: Handler = async (args, ctx) => {
  const files = await ctx.files.list();
  const { offset, limit } = pageWindow(args, PAGE_DEFAULT, PAGE_MAX);
  const page = files.slice(offset, offset + limit);
  const message =
    files.length === 0
      ? 'No recipes yet.'
      : page.length === 0
        ? pastTheEnd(files.length, offset, 'recipe')
        : page.length === files.length
          ? `Showing your ${files.length} recipes.`
          : `Showing recipes ${rangeText(files.length, offset, page.length)}.${nextPageHint(files.length, offset, page.length)}`;
  return recipeListResult(page, message);
};

/** `search_recipes`: recipes whose name contains the query, accents and case ignored. */
const searchRecipes: Handler = async (args, ctx) => {
  const queryRaw = textArg(args['query']);
  const query = foldText(queryRaw);
  const hits = (await ctx.files.list()).filter((f) =>
    foldText(recipeDisplayName(f.name)).includes(query),
  );
  const { offset, limit } = pageWindow(args, PAGE_DEFAULT, PAGE_MAX);
  const page = hits.slice(offset, offset + limit);
  const message =
    hits.length === 0
      ? `No recipes match "${queryRaw}".`
      : page.length === 0
        ? pastTheEnd(hits.length, offset, 'matching recipe')
        : page.length === hits.length
          ? `Found ${countOf(hits.length, 'recipe')} matching "${queryRaw}".`
          : `Found ${countOf(hits.length, 'recipe')} matching "${queryRaw}"; showing ${rangeText(hits.length, offset, page.length)}.${nextPageHint(hits.length, offset, page.length)}`;
  return recipeListResult(page, message, queryRaw);
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
  return withRecipeIn(files, args['recipe'], 'recipe', 'read', async (file) => {
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
      `Recipes similar to "${label(file)}".${indexingNote(waiting)}`,
    );
  });
};

/** `get_recipe`: one recipe, as a card. */
const getRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'read', async (file, others) =>
    recipeCardResult(
      file.id,
      file.name,
      await ctx.files.read(file.id),
      `Showing the "${label(file)}" recipe.${alsoMatchingNote(args['recipe'], others)}`,
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
  const name = plainTitle(recipeDisplayName(outcome.name));
  const message =
    outcome.kind === 'existing'
      ? `"${name}" is already in your recipes.`
      : outcome.kind === 'repaired'
        ? `Repaired "${name}" — the earlier import had no ingredients or steps.`
        : `Imported "${name}".`;
  return recipeCardResult(
    outcome.id,
    outcome.name,
    outcome.source,
    message,
    ctx.system,
  );
};

/** How many recipes of the same name are read to see whether one is the very recipe being saved. */
const NAMESAKES_COMPARED = 3;

/**
 * A recipe's text without its `>>` metadata lines. Tagging adds and rewrites
 * those after a recipe is saved, so two copies of the same recipe are compared
 * on what is left: the ingredients, method and comments.
 */
function bodyOf(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*>>/.test(line))
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** The recipes whose name is `name`, ignoring case, accents and the uncurated marker. */
function namesakes(
  files: readonly DriveFile[],
  name: string,
): readonly DriveFile[] {
  const wanted = foldText(recipeDisplayName(name));
  return files.filter((f) => foldText(recipeDisplayName(f.name)) === wanted);
}

/**
 * Save a new recipe unless that very recipe is already there. Assistants and
 * the gateways in front of them repeat a call that seems to have timed out, and
 * each repeat would otherwise add another file. A recipe of the same name whose
 * body matches is returned as it is; a recipe of the same name with a different
 * body is a different recipe (people do keep two), so it is saved and the
 * result says another one exists.
 *
 * @param name The dish name, as given.
 * @param filename The name the new file is saved under.
 * @param content What the file would hold, before tagging.
 * @param prepare Works out what is written (tagging may add metadata).
 * @param said What to say after saving a new file.
 */
async function saveUnlessThere(
  ctx: ToolContext,
  name: string,
  filename: string,
  content: string,
  prepare: () => Promise<string>,
  said: (file: DriveFile) => string,
): Promise<ToolResult> {
  const same = namesakes(await ctx.files.list(), name);
  const copies = await Promise.all(
    same.slice(0, NAMESAKES_COMPARED).map(async (file) => ({
      file,
      text: await ctx.files.read(file.id),
    })),
  );
  const already = copies.find((copy) => bodyOf(copy.text) === bodyOf(content));
  if (already) {
    return recipeCardResult(
      already.file.id,
      already.file.name,
      already.text,
      `"${label(already.file)}" is already saved with this recipe, so nothing new was added.`,
      ctx.system,
    );
  }
  const other = same.at(0);
  return createAndShow(ctx, filename, await prepare(), (file) =>
    other
      ? `${said(file)} A different recipe with the same name already exists (${candidate(other)}), so there are now ${same.length + 1}.`
      : said(file),
  );
}

/** `add_recipe`: save a recipe the assistant already wrote as Cooklang. */
const addRecipe: Handler = (args, ctx, services) => {
  const dish = textArg(args['name']);
  const content = textArg(args['content']);
  return saveUnlessThere(
    ctx,
    dish,
    dish,
    content,
    () => services.tagBestEffort(content, dish),
    (file) => `Saved "${label(file)}".`,
  );
};

/** `capture_idea`: keep a vague wish as an uncurated stub to turn into a recipe later. */
const captureIdea: Handler = (args, ctx) => {
  const dish = textArg(args['name']);
  const body = buildStubSource({
    name: dish,
    prompt: textArg(args['prompt']),
    draft: args['draft'] ? textArg(args['draft']) : undefined,
  });
  return saveUnlessThere(
    ctx,
    dish,
    uncuratedFilename(dish),
    body,
    async () => body,
    () => `Saved "${plainTitle(dish)}" as an idea to curate later.`,
  );
};

/** One day, in milliseconds. */
const DAY_MS = 86_400_000;

/**
 * The day a cooking-log entry is for: today when none is given, otherwise the
 * date as a UTC day. Undefined for a date that does not exist (the 30th of
 * February) or lies in the future. Tomorrow's date, in UTC, is allowed, because
 * for someone ahead of UTC it is already today.
 *
 * @param now The present moment; a test passes its own.
 */
function cookedOn(date: string | undefined, now: Date): Date | undefined {
  if (date === undefined) {
    return now;
  }
  const day = new Date(`${date}T00:00:00Z`);
  const real =
    !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date;
  return real && day.getTime() < now.getTime() + DAY_MS ? day : undefined;
}

/** `log_cooking`: add a dated note about a time the recipe was cooked. */
const logCooking: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
    const note = textArg(args['note']).trim();
    // The schema refuses a blank note; this keeps an empty line out of the
    // user's file even if a schema is ever loosened.
    if (!note) {
      return errorResult('What should the cooking-log entry say?');
    }
    const when = cookedOn(
      args['date'] === undefined ? undefined : textArg(args['date']),
      new Date(),
    );
    if (!when) {
      return errorResult(
        `\`date\` must be a real day that is not in the future, as YYYY-MM-DD; "${textArg(args['date'])}" is not. Nothing was changed.`,
      );
    }
    return editRecipe(
      ctx,
      file,
      (current) => ({ text: appendCookingLog(current, note, when) }),
      `Logged your note on "${label(file)}".`,
    );
  });

/** `favourite_recipe`: heart a recipe, or take the heart off. */
const favouriteRecipe: Handler = (args, ctx, services) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
    const on = args['favourite'] !== false;
    await services.setFavourite(ctx.user.id, file.id, on);
    return textResult(
      on
        ? `Added "${label(file)}" to your favourites.`
        : `Removed "${label(file)}" from your favourites.`,
    );
  });

/** `tag_recipe`: classify a recipe and write the tags (and a missing cover) onto it. */
const tagRecipe: Handler = (args, ctx, services) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) =>
    editRecipe(
      ctx,
      file,
      async (original) => {
        const { source: tagged, tags } = await services.tag(
          original,
          file.name,
        );
        // Also backfill a missing cover from the recipe's source page.
        const updated = await services.addCover(tagged);
        return tags.length === 0 && updated === original
          ? {
              refusal: errorResult(
                `Couldn't confidently tag "${label(file)}", so nothing was changed.`,
              ),
            }
          : { text: updated };
      },
      `Tagged "${label(file)}".`,
    ),
  );

/** `set_recipe_images`: set the cover and extra photos of a recipe, or remove them. */
const setRecipeImages: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
    const urls = Array.isArray(args['images'])
      ? args['images'].map(String)
      : [];
    const clear = args['clear'] === true;
    if (clear && urls.length > 0) {
      return errorResult(
        'Pass either `images` to set them or `clear: true` to remove them, not both. Nothing was changed.',
      );
    }
    if (!clear && validImageUrls(urls).length === 0) {
      return errorResult('Pass at least one http(s) image URL in `images`.');
    }
    return editRecipe(
      ctx,
      file,
      (current) => ({
        text: clear
          ? removeMetadata(current, 'images')
          : withImages(current, urls),
      }),
      clear
        ? `Removed the images from "${label(file)}".`
        : `Set the cover for "${label(file)}".`,
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

/**
 * Work out where an `annotate_recipe` call wants its note. A call that gives
 * both an ingredient and a step is refused before this is asked (see
 * {@link annotateRecipe}); if both ever got here the ingredient would win.
 */
export function noteTarget(args: Args): NoteTarget {
  const ingredient = args['ingredient']
    ? textArg(args['ingredient']).trim()
    : '';
  const step = args['step'];
  if (ingredient) {
    return {
      scope: 'ingredient',
      key: ingredient,
      where: ` on ${plainTitle(ingredient)}`,
    };
  }
  return step != null
    ? { scope: 'step', key: String(step), where: ` on step ${String(step)}` }
    : { scope: 'general', key: '', where: '' };
}

/** How many of a recipe's ingredients an error lists when the one asked for is not among them. */
const INGREDIENTS_LISTED = 12;

/**
 * What is wrong with attaching a note to this ingredient or step of this recipe,
 * if anything: a note on something the recipe does not have would be filed under
 * "general" with a label, which is not what was asked for. Says what the recipe
 * does have, so the assistant can correct the call.
 */
function noteTargetProblem(
  recipe: Readonly<
    Pick<ReturnType<typeof parseRecipe>, 'ingredients' | 'steps'>
  >,
  target: Readonly<NoteTarget>,
): string | undefined {
  if (target.scope === 'step') {
    const count = recipe.steps.length;
    return Number(target.key) > count
      ? count === 0
        ? 'That recipe has no numbered steps, so a note cannot be attached to one. Nothing was changed; leave `step` out for a note on the whole recipe.'
        : `That recipe has ${countOf(count, 'step')}, so there is no step ${target.key}. Nothing was changed.`
      : undefined;
  }
  if (target.scope === 'ingredient') {
    const wanted = foldText(target.key);
    const fits = recipe.ingredients.some((ingredient) => {
      const name = foldText(ingredient.name);
      return name.includes(wanted) || wanted.includes(name);
    });
    return fits
      ? undefined
      : `That recipe has no ingredient called "${plainTitle(target.key)}". ` +
          (recipe.ingredients.length > 0
            ? `Its ingredients are: ${recipe.ingredients
                .slice(0, INGREDIENTS_LISTED)
                .map((i) => plainTitle(i.name))
                .join(
                  ', ',
                )}${recipe.ingredients.length > INGREDIENTS_LISTED ? ', and more' : ''}. `
            : '') +
          'Nothing was changed; leave `ingredient` out for a note on the whole recipe.';
  }
  return undefined;
}

/** `annotate_recipe`: add a personal note without changing the original recipe. */
const annotateRecipe: Handler = (args, ctx) =>
  withRecipe(ctx, args['recipe'], 'recipe', 'write', async (file) => {
    const noteText = textArg(args['note']).trim();
    if (!noteText) {
      return errorResult('What note should I add?');
    }
    const hasIngredient = Boolean(textArg(args['ingredient']).trim());
    if (hasIngredient && args['step'] != null) {
      return errorResult(
        'A note goes in one place: give either `ingredient` or `step`, not both. Nothing was changed.',
      );
    }
    const target = noteTarget(args);
    return editRecipe(
      ctx,
      file,
      (current) => {
        const problem = noteTargetProblem(
          parseRecipe(current, file.name),
          target,
        );
        return problem
          ? { refusal: errorResult(problem) }
          : {
              text: appendNote(current, {
                scope: target.scope,
                key: target.key,
                text: noteText,
              }),
            };
      },
      `Added your note${target.where} to "${label(file)}".`,
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

/** How a tool is told apart from its arguments when the arguments are checked. */
type ToolSchema = Readonly<{ name: string; inputSchema: JsonSchema }>;

/** The arguments a tool takes, as one line the assistant can follow: "recipe (required), note (required), step". */
function usage(schema: JsonSchema): string {
  const required = new Set(schema.required ?? []);
  const names = Object.keys(schema.properties ?? {}).map((key) =>
    required.has(key) ? `${key} (required)` : key,
  );
  return names.length > 0
    ? `The arguments are: ${names.join(', ')}.`
    : 'This tool takes no arguments.';
}

/** The arguments of a call that passed the check, or the answer to give when they did not. */
type Checked = { readonly args: Args } | { readonly refusal: ToolResult };

/**
 * The arguments of a call, checked against the tool's input schema.
 *
 * Arguments that fit are returned (with the alias and list spellings that
 * {@link canonicalArguments} corrects). Arguments that do not fit are a mistake
 * the assistant can correct, so they come back as an `isError` result naming
 * each problem and the arguments the tool takes (the spec lists input validation
 * among tool execution errors, which a host always shows the model).
 *
 * @throws {InvalidToolArguments} If `arguments` is not an object at all: that is
 *   a malformed request, not a mistaken call.
 */
function checkedArguments(tool: ToolSchema, rawArgs: unknown): Checked {
  // Omitted arguments count as none, so the schema can say what is required.
  const given = rawArgs === undefined ? {} : rawArgs;
  if (!isJsonObject(given)) {
    throw new InvalidToolArguments(['`arguments` must be an object.']);
  }
  const args = canonicalArguments(tool.name, given);
  const problems = validateJson(tool.inputSchema, args, 'The arguments');
  return problems.length > 0
    ? {
        refusal: errorResult(
          `Invalid arguments for ${tool.name}: ${problems.join(' ')} ${usage(tool.inputSchema)}`,
        ),
      }
    : { args };
}

/**
 * Execute a `tools/call` for `user`.
 *
 * @param openContext How Drive is opened; tests pass a fake.
 * @param services The database, AI and page fetching; tests pass fakes.
 * @returns The tool's result; for arguments that do not fit the tool's schema,
 *   an `isError` result saying what to change. Nothing is opened or run for
 *   those.
 * @throws {UnknownTool} If no such tool exists.
 * @throws {InvalidToolArguments} If the request has no tool name, or its
 *   `arguments` is not an object (both are malformed requests).
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
  const checked = checkedArguments(tool, params?.['arguments']);
  if ('refusal' in checked) {
    return checked.refusal;
  }
  const { args } = checked;

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
  // Checked before Drive is opened, so a refusal costs nothing.
  if (MODEL_TOOLS.has(name)) {
    const wait = await services.spendModelBudget(user.id);
    if (wait !== undefined) {
      return errorResult(
        `The daily allowance for importing, adding and tagging recipes through an assistant is used up. It renews in about ${Math.ceil(wait / 3600)} hour(s). Everything that only reads recipes still works.`,
      );
    }
  }
  return DRIVE_TOOLS[name](args, await openContext(user), services);
}

/**
 * Run a `tools/call`. Someone who has signed in but not yet connected their
 * Google Drive has no recipes for the assistant to reach, and Drive, the
 * database or a model can fail mid-call; both are explained in words the
 * assistant can pass on, as a tool error, instead of a protocol error. An
 * unknown tool or a malformed request is still thrown for the router to answer
 * as a protocol error.
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
      logError({
        event: 'mcp.backend_failed',
        service: error.service,
        error: errorMessage(error.cause),
      });
      return errorResult(
        `Something went wrong with ${error.service}, so that did not work. Try again in a minute; if it keeps failing, tell the user.`,
      );
    }
    throw error;
  }
}
