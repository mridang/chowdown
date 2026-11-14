/**
 * @packageDocumentation
 *
 * What more than one recipe tool needs: finding the recipe an argument names
 * among the files in Drive, editing one safely, saving a new one, and the
 * wording of the notes and page messages that several tools share.
 *
 * It sits beside the tools rather than inside one of them because these are the
 * parts two tools must agree on. Finding a recipe by a loose reference has to
 * behave the same whether the assistant is opening it or editing it, and the
 * message that says a result was cut short has to read the same in every list.
 */

import type { User } from '@/domain/db/users';

import { type DriveFile } from '@/lib/google/drive';
import { countOf, foldText } from '@/lib/intl';
import { parseRecipe, recipeDisplayName } from '@/lib/cooklang';
import { resolveFile } from '@/domain/recipe/match';
import { numberArg, offsetArg, textArg } from '@/lib/mcp';
import { runScenarioTool, type ScenarioToolName } from '@/domain/mcp/scenarios';
import {
  errorResult,
  recipeCardResult,
  recipeListSummaryResult,
  textResult,
  type ToolResult,
} from '@/domain/mcp/tool-results';
import {
  nextPageHint,
  pastTheEnd,
  plainTitle,
  rangeText,
} from '@/domain/mcp/tool-text';
import {
  EMBEDDINGS_PER_CALL,
  type ToolContext,
  type ToolServices,
} from '@/domain/mcp/tool-services';
import type { ToolArgs } from '@/domain/mcp/tools/tool';

/** How many close names to offer when a recipe is not found. */
export const SUGGESTION_COUNT = 5;

/**
 * A recipe's name as a sentence quotes it. Names are other people's words (a
 * file name in Drive, a title from an imported page), so they are flattened to
 * one line first (see {@link plainTitle}).
 */
export function label(file: DriveFile): string {
  return plainTitle(recipeDisplayName(file.name));
}

/** A recipe as "Name (id: abc)", the way messages list the candidates. */
export function candidate(file: DriveFile): string {
  return `${label(file)} (id: ${file.id})`;
}

/**
 * Up to {@link SUGGESTION_COUNT} recipes whose names share a word (of three or
 * more letters) with what was asked for, so "No recipe found" can offer
 * something to try instead of a dead end.
 */
export function closeNames(
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
export function notFound(
  files: readonly DriveFile[],
  asked: string,
): ToolResult {
  const near = closeNames(files, asked);
  return errorResult(
    `No recipe found matching "${asked.trim()}". ` +
      (near.length > 0
        ? `Recipes with similar names: ${near.map((file) => candidate(file)).join('; ')}.`
        : 'list_recipes shows every saved recipe and search_recipes finds one by name.'),
  );
}

/** The error for a write whose recipe reference fits several recipes. */
export function ambiguous(
  asked: string,
  key: string,
  matches: readonly DriveFile[],
): ToolResult {
  const shown = matches.slice(0, SUGGESTION_COUNT);
  const more = matches.length - shown.length;
  const andMore = more > 0 ? `; and ${more} more` : '';
  return errorResult(
    `Several recipes match "${asked.trim()}", so nothing was changed: ${shown.map((file) => candidate(file)).join('; ')}${andMore}. ` +
      `Call again with the id of the one you mean as \`${key}\`.`,
  );
}

/** Whether a tool reads a recipe or is about to change it. */
export type Intent = 'read' | 'write';

/**
 * Find the recipe an argument names among `files` and run `then` on it, or
 * answer why not. A reference that fits no recipe is an error that offers close
 * names. One that fits several recipes is an error too when the tool is about
 * to change one (`write`: it must not guess which file to edit), listing the
 * candidates with their ids; a tool that only reads (`read`) shows the best
 * match and is told the other candidates, so it can say so.
 * @param key - The argument the reference came from, for the message.
 */
export async function withRecipeIn(
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
    case 'none': {
      return notFound(files, reference);
    }
    case 'one': {
      return then(match.file, []);
    }
    case 'many': {
      const [best, ...others] = match.files;
      return intent === 'read'
        ? then(best, others)
        : ambiguous(reference, key, match.files);
    }
  }
}

/** {@link withRecipeIn} on the files in the user's Recipes folder. */
export async function withRecipe(
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
export function alsoMatchingNote(
  asked: unknown,
  others: readonly DriveFile[],
): string {
  return others.length > 0
    ? ` "${textArg(asked).trim()}" also matches ${others
        .slice(0, SUGGESTION_COUNT)
        .map((file) => candidate(file))
        .join('; ')}; use an id to choose.`
    : '';
}

/** A sentence saying some recipes are not searchable yet, or nothing if all are. */
export function indexingNote(waiting: number): string {
  return waiting > 0
    ? ` ${countOf(waiting, 'recipe')} not searchable yet: at most ${EMBEDDINGS_PER_CALL} new or edited recipes are indexed per search, so these results may be incomplete. Search again to include more.`
    : '';
}

/** How many times an edit is worked out afresh when the file changes under it. */
/** What an edit to a recipe's text decides: the new text, or an answer to give instead of saving. */
export type Edited =
  { readonly text: string } | { readonly refusal: ToolResult };

export const EDIT_ATTEMPTS = 5;

/** How often each line occurs in a text, for telling what an edit added. */
export function lineCounts(text: string): ReadonlyMap<string, number> {
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
export function editSurvived(
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
 * @param edit - Works out the new text from the current text, or refuses (an
 * answer to return as it is, with nothing written). It may be run more than
 * once, so it must not have effects of its own.
 * @param message - The sentence that goes with the card.
 */
export async function editRecipe(
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
export async function createAndShow(
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
export interface PageWindow {
  readonly offset: number;
  readonly limit: number;
}

/** The page the `limit` and `offset` arguments ask for, with `limit` kept to 1..`max`. */
export function pageWindow(
  args: ToolArgs,
  fallback: number,
  max: number,
): PageWindow {
  const limit = Math.floor(numberArg(args['limit']) ?? fallback);
  return {
    offset: offsetArg(args['offset']),
    limit: Math.min(Math.max(limit, 1), max),
  };
}

/** What `list_recipes` says about the page it shows, out of `total` recipes. */
export function listingMessage(
  total: number,
  offset: number,
  shown: number,
): string {
  if (total === 0) {
    return 'No recipes yet.';
  }
  if (shown === 0) {
    return pastTheEnd(total, offset, 'recipe');
  }
  if (shown === total) {
    return `Showing your ${countOf(total, 'recipe')}.`;
  }
  return `Showing recipes ${rangeText(total, offset, shown)}.${nextPageHint(total, offset, shown)}`;
}

/** What `search_recipes` says about the page it shows, out of `total` matches. */
export function searchingMessage(
  queryRaw: string,
  total: number,
  offset: number,
  shown: number,
): string {
  if (total === 0) {
    return `No recipes match "${queryRaw}".`;
  }
  if (shown === 0) {
    return pastTheEnd(total, offset, 'matching recipe');
  }
  if (shown === total) {
    return `Found ${countOf(total, 'recipe')} matching "${queryRaw}".`;
  }
  return `Found ${countOf(total, 'recipe')} matching "${queryRaw}"; showing ${rangeText(total, offset, shown)}.${nextPageHint(total, offset, shown)}`;
}

/** How many recipes of the same name are read to see whether one is the very recipe being saved. */
export const NAMESAKES_COMPARED = 3;

/**
 * A recipe's text without its `>>` metadata lines. Tagging adds and rewrites
 * those after a recipe is saved, so two copies of the same recipe are compared
 * on what is left: the ingredients, method and comments.
 */
export function bodyOf(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*>>/.test(line))
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** The recipes whose name is `name`, ignoring case, accents and the uncurated marker. */
export function namesakes(
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
 * @param name - The dish name, as given.
 * @param filename - The name the new file is saved under.
 * @param content - What the file would hold, before tagging.
 * @param prepare - Works out what is written (tagging may add metadata).
 * @param said - What to say after saving a new file.
 */
export async function saveUnlessThere(
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

/** One day, in milliseconds. */
export const DAY_MS = 86_400_000;

/**
 * The day a cooking-log entry is for: today when none is given, otherwise the
 * date as a UTC day. Undefined for a date that does not exist (the 30th of
 * February) or lies in the future. Tomorrow's date, in UTC, is allowed, because
 * for someone ahead of UTC it is already today.
 * @param now - The present moment; a test passes its own.
 */
export function cookedOn(
  date: string | undefined,
  now: Date,
): Date | undefined {
  if (date === undefined) {
    return now;
  }
  const day = new Date(`${date}T00:00:00Z`);
  const real =
    !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date;
  return real && day.getTime() < now.getTime() + DAY_MS ? day : undefined;
}

/** Where a personal note attaches: an ingredient, a step, or the recipe as a whole. */
export interface NoteTarget {
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
export function noteTarget(args: ToolArgs): NoteTarget {
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
  return step == null
    ? { scope: 'general', key: '', where: '' }
    : { scope: 'step', key: String(step), where: ` on step ${String(step)}` };
}

/** How many of a recipe's ingredients an error lists when the one asked for is not among them. */
export const INGREDIENTS_LISTED = 12;

/**
 * What is wrong with attaching a note to this ingredient or step of this recipe,
 * if anything: a note on something the recipe does not have would be filed under
 * "general" with a label, which is not what was asked for. Says what the recipe
 * does have, so the assistant can correct the call.
 */
export function noteTargetProblem(
  recipe: Readonly<
    Pick<ReturnType<typeof parseRecipe>, 'ingredients' | 'steps'>
  >,
  target: Readonly<NoteTarget>,
): string | undefined {
  if (target.scope === 'step') {
    const count = recipe.steps.length;
    if (Number(target.key) > count) {
      return count === 0
        ? 'That recipe has no numbered steps, so a note cannot be attached to one. Nothing was changed; leave `step` out for a note on the whole recipe.'
        : `That recipe has ${countOf(count, 'step')}, so there is no step ${target.key}. Nothing was changed.`;
    }
    return undefined;
  }
  if (target.scope === 'ingredient') {
    const wanted = foldText(target.key);
    const fits = recipe.ingredients.some((ingredient) => {
      const name = foldText(ingredient.name);
      return name.includes(wanted) || wanted.includes(name);
    });
    if (fits) {
      return undefined;
    }
    const listed = recipe.ingredients
      .slice(0, INGREDIENTS_LISTED)
      .map((i) => plainTitle(i.name))
      .join(', ');
    const more =
      recipe.ingredients.length > INGREDIENTS_LISTED ? ', and more' : '';
    const its =
      recipe.ingredients.length > 0
        ? `Its ingredients are: ${listed}${more}. `
        : '';
    return (
      `That recipe has no ingredient called "${plainTitle(target.key)}". ` +
      its +
      'Nothing was changed; leave `ingredient` out for a note on the whole recipe.'
    );
  }
  return undefined;
}

/**
 * The daily allowance for the tools that ask a model on the person's behalf,
 * spent before the tool runs. A refusal to give back when it is used up, else
 * undefined to carry on.
 *
 * It is spent in {@link McpTool.precheck} rather than inside the tool so that a
 * refusal costs nothing: at that point nothing has been opened and no file has
 * been read.
 */
export async function modelBudgetRefusal(
  user: Readonly<User>,
  services: ToolServices,
): Promise<ToolResult | undefined> {
  const wait = await services.spendModelBudget(user.id);
  return wait === undefined
    ? undefined
    : errorResult(
        `The daily allowance for importing, adding and tagging recipes through an assistant is used up. It renews in about ${Math.ceil(wait / 3600)} hour(s). Everything that only reads recipes still works.`,
      );
}

/**
 * Run a question-shaped tool. They read the D1 cache, so they never touch
 * Drive unless the cache is empty and has to be filled.
 */
export async function runScenario(
  user: Readonly<User>,
  tool: ScenarioToolName,
  args: ToolArgs,
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
