/**
 * @packageDocumentation
 *
 * The question-shaped MCP tools: "I feel like cooking Indian today" (browse by
 * cuisine, diet, time…) and "I have 3 tomatoes and 400 g of pasta — what can I
 * make?" (match the pantry against the collection). Everything here works on
 * the recipes cached in D1, so it never touches Drive, and it is pure so the
 * wording and ranking can be tested without a server.
 */

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import type { Recipe } from '@/domain/db/recipes';
import { countOf, foldText, listAnd } from '@/lib/intl';
import { recipeDisplayName } from '@/lib/cooklang/cook-text';
import { parseRecipe, type ParsedRecipe } from '@/lib/cooklang/cooklang';
import {
  DIET_TYPES,
  suitableFor,
  type DietType,
} from '@/domain/recipe/diet-type';
import { minutesOf } from '@/domain/recipe/minutes';
import {
  matchRecipe,
  rankMatches,
  type PantryMatch,
} from '@/domain/recipe/pantry-match';
import { FACETS, facet } from '@/domain/recipe/taxonomy';
import { rowTags, type RecipeTags } from '@/domain/recipe/tag-index';
import { pantryOf } from '@/domain/mcp/pantry-input';
import {
  limitArg,
  numberArg,
  offsetArg,
  stringArg,
  stringListArg,
} from '@/lib/mcp/tool-args';
import { pastTheEnd, plainTitle, rangeText } from '@/domain/mcp/tool-text';

/** A cached recipe, parsed once, with what the scenario tools look at. */
export interface ScenarioRecipe {
  readonly id: string;
  /** The name as shown, without `.cook` or the uncurated marker. */
  readonly name: string;
  /** The file name, kept so results can render as a recipe list. */
  readonly filename: string;
  readonly tags: RecipeTags;
  /** Total time in minutes, when the recipe says. */
  readonly minutes?: number;
  readonly ingredients: ParsedRecipe['ingredients'];
  readonly favourite: boolean;
}

/** Parse a cached row for the scenario tools. */
export function toScenarioRecipe(
  row: Readonly<Recipe>,
  favourite: boolean,
): ScenarioRecipe {
  const parsed = parseRecipe(row.source, row.name);
  const time = parsed.metadata.find(([k]) => k.toLowerCase() === 'time')?.[1];
  return {
    id: row.drive_file_id,
    name: recipeDisplayName(row.name),
    filename: row.name,
    tags: rowTags(row, parsed),
    minutes: minutesOf(time),
    ingredients: parsed.ingredients,
    favourite,
  };
}

/** What a scenario tool hands back: model-readable text and the matching recipes. */
export interface ScenarioResult {
  readonly message: string;
  readonly recipes: readonly ScenarioRecipe[];
  readonly isError?: boolean;
}

/** Whether a string is one of the four eating styles. */
function isDietType(value: string): value is DietType {
  return (DIET_TYPES as readonly string[]).includes(value);
}

/** The values that satisfy an eating-style request: vegetarian takes vegan too. */
function dietsFor(wanted: readonly string[]): readonly string[] {
  return [
    ...new Set(wanted.flatMap((w) => (isDietType(w) ? suitableFor(w) : []))),
  ];
}

/** Where an eating style comes in the usual order; anything else goes last. */
function dietPosition(style: string): number {
  const index = (DIET_TYPES as readonly string[]).indexOf(style);
  return index < 0 ? DIET_TYPES.length : index;
}

/** The position of a recipe's eating style in the usual order, for sorting. */
function dietRank(recipe: ScenarioRecipe): number {
  return dietPosition(recipe.tags['diet_type']?.[0] ?? '');
}

/** The recipe's eating style, e.g. "Vegetarian". */
function dietOf(recipe: ScenarioRecipe): string {
  return recipe.tags['diet_type']?.[0] ?? 'Unclassified';
}

/** Order recipes by name, the way the tool results list them. */
function byName(a: ScenarioRecipe, b: ScenarioRecipe): number {
  return a.name.localeCompare(b.name);
}

/**
 * One recipe as a line of text: name, plus the details worth scanning and the id
 * a later call (`get_recipe`, or reading the recipe resource) can use to ask for
 * exactly this one, since names are not unique.
 */
function line(recipe: ScenarioRecipe): string {
  const bits = [
    recipe.tags['cuisine']?.join('/'),
    recipe.minutes ? `${recipe.minutes} min` : undefined,
    recipe.tags['difficulty']?.[0],
    `id: ${recipe.id}`,
  ].filter(Boolean);
  return `- ${plainTitle(recipe.name)} (${bits.join(', ')})`;
}

/**
 * Up to `limit` recipes, taken in turn from each eating style so that a short
 * list still shows a vegan, a vegetarian and a meat dish rather than the first
 * style filling it. Within a style they go alphabetically.
 */
function spread(
  recipes: readonly ScenarioRecipe[],
  limit: number,
): readonly ScenarioRecipe[] {
  const queues = [...Map.groupBy(recipes.toSorted(byName), dietRank)]
    .toSorted(([a], [b]) => a - b)
    .map(([, list]) => list);
  const rounds = Math.max(0, ...queues.map((queue) => queue.length));
  // Round 0 is every style's first recipe, round 1 every style's second, …
  return Array.from({ length: rounds }, (_, round) =>
    queues.flatMap((queue) => queue.slice(round, round + 1)),
  )
    .flat()
    .slice(0, limit);
}

/** A run of recipes sharing an eating style, as lines of text. */
interface DietRun {
  readonly diet: string;
  readonly lines: readonly string[];
}

/** Recipes grouped under their eating style, in the usual order. */
function groupedByDiet(recipes: readonly ScenarioRecipe[]): string {
  const sorted = recipes.toSorted(
    (a, b) => dietRank(a) - dietRank(b) || byName(a, b),
  );
  const runs = sorted.reduce<readonly DietRun[]>((done, recipe) => {
    const diet = dietOf(recipe);
    const last = done.at(-1);
    return last?.diet === diet
      ? [...done.slice(0, -1), { diet, lines: [...last.lines, line(recipe)] }]
      : [...done, { diet, lines: [line(recipe)] }];
  }, []);
  return runs
    .flatMap((run) => [`\n${run.diet}:`, ...run.lines])
    .join('\n')
    .trim();
}

/** The values of a facet argument that the taxonomy knows, or an error line. */
function facetWanted(
  key: string,
  raw: unknown,
): { readonly wanted: readonly string[]; readonly problem?: string } {
  const wanted = stringListArg(raw);
  const f = facet(key);
  if (!f || !f.values || wanted.length === 0) {
    return { wanted };
  }
  const known = new Map(f.values.map((v) => [foldText(v), v]));
  const unrecognised = wanted.filter((w) => !known.has(foldText(w)));
  if (unrecognised.length > 0) {
    return {
      wanted: [],
      problem: `${f.label}: "${unrecognised.join('", "')}" isn't one of ${listAnd(f.values)}.`,
    };
  }
  return { wanted: wanted.flatMap((w) => known.get(foldText(w)) ?? []) };
}

/** Whether a recipe carries any of the wanted values for a facet. */
function hasAny(
  recipe: ScenarioRecipe,
  key: string,
  wanted: readonly string[],
): boolean {
  if (wanted.length === 0) {
    return true;
  }
  const have = (recipe.tags[key] ?? []).map(foldText);
  return wanted.some((w) => have.includes(foldText(w)));
}

/**
 * The facets the browse tool takes: the tool argument that carries each, and the
 * taxonomy facet it filters on. They differ for one: dietary needs such as
 * gluten-free are asked for as `dietary_needs` (so the name does not read as a
 * near twin of `diet_type`, the eating style) but live in the facet `diet`.
 */
const BROWSE_FACETS = [
  { arg: 'cuisine', facet: 'cuisine' },
  { arg: 'protein', facet: 'protein' },
  { arg: 'diet_type', facet: 'diet_type' },
  { arg: 'dietary_needs', facet: 'diet' },
  { arg: 'category', facet: 'category' },
  { arg: 'method', facet: 'method' },
  { arg: 'difficulty', facet: 'difficulty' },
] as const;

/** A note on how many recipes a time limit left out for not stating a time. */
function untimedNote(untimed: number): string {
  if (untimed === 0) {
    return '';
  }
  const one = untimed === 1;
  return `\n\n(${countOf(untimed, 'other recipe')} fit${one ? 's' : ''} the rest but ${one ? "doesn't" : "don't"} say how long ${one ? 'it takes' : 'they take'}.)`;
}

/**
 * "What could I cook?" by cuisine, eating style, protein, time and so on.
 * Results come back grouped by eating style, vegan first.
 */
export function browseRecipes(
  recipes: readonly ScenarioRecipe[],
  args: Readonly<Record<string, unknown>>,
): ScenarioResult {
  const checked = BROWSE_FACETS.map(
    ({ arg, facet: key }) => [key, facetWanted(key, args[arg])] as const,
  );
  const problem = checked.map(([, result]) => result.problem).find(Boolean);
  if (problem) {
    return { message: problem, recipes: [], isError: true };
  }
  const wanted = new Map<string, readonly string[]>(
    checked.map(([key, result]) => [key, result.wanted]),
  );
  // Asking for vegetarian also takes vegan dishes; every other facet is exact.
  const matching = (key: string): readonly string[] =>
    key === 'diet_type'
      ? dietsFor(wanted.get(key) ?? [])
      : (wanted.get(key) ?? []);
  const maxMinutes = numberArg(args['max_minutes']);
  const query = stringArg(args['query']);
  const words = foldText(query).split(/\s+/).filter(Boolean);
  const favouritesOnly = args['favourites_only'] === true;

  // Everything but the time limit, so the recipes a time limit left out for not
  // stating a time can be counted.
  const fitsRest = (r: ScenarioRecipe): boolean =>
    BROWSE_FACETS.every(({ facet: key }) => hasAny(r, key, matching(key))) &&
    (!favouritesOnly || r.favourite) &&
    words.every((w) => foldText(r.name).includes(w));
  const hits = recipes.filter(
    (r) =>
      fitsRest(r) &&
      (maxMinutes === undefined ||
        (r.minutes !== undefined && r.minutes <= maxMinutes)),
  );

  const asked = BROWSE_FACETS.flatMap(
    ({ facet: key }) => wanted.get(key) ?? [],
  );
  const also = [
    maxMinutes !== undefined ? `at most ${maxMinutes} minutes` : '',
    favouritesOnly ? 'favourites only' : '',
    words.length ? `named like "${query}"` : '',
  ].filter(Boolean);
  const subject =
    (asked.length ? ` for ${asked.join(', ')}` : '') +
    (also.length ? ` (${also.join(', ')})` : '');

  // Recipes that don't say how long they take can't be matched to a time limit.
  const note = untimedNote(
    maxMinutes === undefined
      ? 0
      : recipes.filter((r) => r.minutes === undefined && fitsRest(r)).length,
  );

  if (hits.length === 0) {
    return {
      message:
        `No recipes${subject}. Use list_filters to see what the collection holds` +
        ' — or offer to import one.' +
        note,
      recipes: [],
    };
  }
  // The round-robin order does not depend on how many are asked for, so taking
  // the first `offset + limit` and dropping the first `offset` gives pages that
  // follow one another without gaps or repeats.
  const offset = offsetArg(args['offset']);
  const shown = spread(hits, offset + limitArg(args['limit'])).slice(offset);
  if (shown.length === 0) {
    return {
      message: pastTheEnd(hits.length, offset, 'matching recipe') + note,
      recipes: [],
    };
  }
  const next = offset + shown.length;
  const more =
    offset > 0 || hits.length > shown.length
      ? ` (showing ${shownOf(hits.length, offset, shown.length)}, a mix of eating styles${next < hits.length ? `; call again with offset=${next} for the next page` : ''})`
      : '';
  return {
    message: `${countOf(hits.length, 'recipe')}${subject}${more}:\n\n${groupedByDiet(shown)}${note}`,
    recipes: shown,
  };
}

/**
 * How much of a list is shown: "5 of 30" for the first page, "13-24 of 30" for a
 * later one.
 */
function shownOf(total: number, offset: number, shown: number): string {
  return offset === 0
    ? `${shown} of ${total}`
    : rangeText(total, offset, shown);
}

/** "5", or "showing 5 of 30" (or "showing 13-24 of 30") when the list was cut short. */
function countText(shown: number, total: number, offset: number): string {
  return shown < total || offset > 0
    ? `showing ${shownOf(total, offset, shown)}`
    : String(total);
}

/** A long ingredient name shortened to fit a line. */
function brief(name: string): string {
  return name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name;
}

/** What stands between the person and cooking this, in a few words. */
function gapText(match: PantryMatch, listUpTo = Infinity): string {
  const shown = match.missing.slice(0, listUpTo).map(brief);
  const rest = match.missing.length - shown.length;
  const missing =
    match.missing.length > 0
      ? [`missing ${listAnd(shown)}${rest > 0 ? ` and ${rest} more` : ''}`]
      : [];
  const short = match.short.map(
    (s) => `need more ${brief(s.name)} (have ${s.have}, need ${s.need})`,
  );
  return [...missing, ...short].join('; ');
}

/** A recipe paired with how it fares against the pantry. */
interface Matched {
  readonly recipe: ScenarioRecipe;
  readonly match: PantryMatch;
}

/** How many things stand between the person and cooking a recipe. */
function gapSize({ match }: Matched): number {
  return match.missing.length + match.short.length;
}

/** The recipes closest to being cookable when none is within reach: most of the pantry used first, then fewest gaps. */
function closestMatches(
  matches: readonly Matched[],
  limit: number,
): readonly Matched[] {
  return rankMatches(matches, Infinity)
    .almost.toSorted(
      (a, b) => b.match.used - a.match.used || gapSize(a) - gapSize(b),
    )
    .slice(0, Math.min(limit, 5));
}

/**
 * "I have 3 tomatoes and 400 g of pasta — what can I make?" Splits the
 * collection into what can be cooked now and what is a few items short.
 */
export function recipesFromIngredients(
  recipes: readonly ScenarioRecipe[],
  args: Readonly<Record<string, unknown>>,
): ScenarioResult {
  const pantry = pantryOf(args['ingredients']);
  if (pantry.length === 0) {
    return {
      message:
        'Tell me what you have, e.g. ["3 tomatoes", "400 g pasta"], and I will look for recipes.',
      recipes: [],
      isError: true,
    };
  }
  const allowMissing = Math.max(
    0,
    Math.floor(numberArg(args['allow_missing']) ?? 2),
  );
  const assumeStaples = args['assume_staples'] !== false;
  const { wanted: diets, problem } = facetWanted(
    'diet_type',
    args['diet_type'],
  );
  if (problem) {
    return { message: problem, recipes: [], isError: true };
  }

  const matches: readonly Matched[] = recipes
    .filter((r) => hasAny(r, 'diet_type', dietsFor(diets)))
    .map((recipe) => ({
      recipe,
      match: matchRecipe(recipe.ingredients, pantry, { assumeStaples }),
    }));
  const ranked = rankMatches(matches, allowMissing);
  const limit = limitArg(args['limit']);
  const offset = offsetArg(args['offset']);
  const canMake = ranked.canMake.slice(offset, offset + limit);
  const almost = ranked.almost.slice(offset, offset + limit);
  const have = listAnd(
    pantry.map((p) => (p.quantity ? `${p.quantity} ${p.name}` : p.name)),
  );
  const reachable = ranked.canMake.length + ranked.almost.length;

  if (reachable > 0 && canMake.length === 0 && almost.length === 0) {
    return {
      message: `With ${have}: ${pastTheEnd(Math.max(ranked.canMake.length, ranked.almost.length), offset, 'recipe')}`,
      recipes: [],
    };
  }
  if (reachable === 0) {
    // Nothing is within reach, so show what comes closest rather than a dead end.
    const closest = closestMatches(matches, limit);
    if (closest.length === 0) {
      return {
        message:
          `Nothing in the collection uses ${have}. ` +
          'Ask for something to cook by cuisine or eating style instead, or import a recipe that does.',
        recipes: [],
      };
    }
    return {
      message:
        `Nothing can be made from ${have} as it stands. The closest, which need a shop:\n` +
        closest
          .map(
            ({ recipe, match }) =>
              `${line(recipe)} — ${dietOf(recipe)}; ${gapText(match, 4)}`,
          )
          .join('\n'),
      recipes: closest.map((m) => m.recipe),
    };
  }

  const sections = [
    `With ${have}:`,
    ...(canMake.length
      ? [
          `\nYou can make now (${countText(canMake.length, ranked.canMake.length, offset)}):\n` +
            canMake
              .map(
                ({ recipe, match }) =>
                  `${line(recipe)} — ${dietOf(recipe)}; uses ${match.used} of your ${pantry.length}`,
              )
              .join('\n'),
        ]
      : []),
    ...(almost.length
      ? [
          `\nAlmost there (${countText(almost.length, ranked.almost.length, offset)}):\n` +
            almost
              .map(
                ({ recipe, match }) =>
                  `${line(recipe)} — ${dietOf(recipe)}; ${gapText(match)}`,
              )
              .join('\n'),
        ]
      : []),
  ];
  const furthest = Math.max(ranked.canMake.length, ranked.almost.length);
  return {
    message:
      sections.join('\n') +
      (offset + limit < furthest
        ? `\n\nThere are more: call again with offset=${offset + limit} for the next page of each list.`
        : ''),
    recipes: [...canMake, ...almost].map((m) => m.recipe),
  };
}

/** How often each value occurs among the recipes' tags for one facet, in order of first appearance. */
function tally(
  recipes: readonly ScenarioRecipe[],
  key: string,
): ReadonlyMap<string, number> {
  const values = recipes.flatMap((r) => r.tags[key] ?? []);
  return new Map(
    [...Map.groupBy(values, (v) => v)].map(([value, group]) => [
      value,
      group.length,
    ]),
  );
}

/** The values each facet holds in the collection, with counts. */
export function filterOverview(
  recipes: readonly ScenarioRecipe[],
): ScenarioResult {
  if (recipes.length === 0) {
    return { message: 'No recipes yet.', recipes: [] };
  }
  const sections = FACETS.flatMap((f) => {
    const counted = tally(recipes, f.key);
    const classified = [...counted.values()].reduce((a, b) => a + b, 0);
    // Recipes with no eating style are counted too, so the totals add up.
    const counts =
      f.key === 'diet_type' && classified < recipes.length
        ? new Map([...counted, ['Unclassified', recipes.length - classified]])
        : counted;
    if (counts.size === 0) {
      return [];
    }
    // Eating styles keep their usual order; the rest go most common first.
    const entries = [...counts].toSorted(([a, x], [b, y]) =>
      f.key === 'diet_type'
        ? dietPosition(a) - dietPosition(b)
        : y - x || a.localeCompare(b),
    );
    return [
      `\n${f.label} (${f.key}): ${entries.map(([v, n]) => `${v} ${n}`).join(', ')}`,
    ];
  });
  return {
    message: [`${countOf(recipes.length, 'recipe')} saved.`, ...sections].join(
      '\n',
    ),
    recipes: [],
  };
}

/** The names of the tools in this module. */
export const SCENARIO_TOOLS = [
  'browse_recipes',
  'recipes_from_ingredients',
  'list_filters',
] as const;

/** One of {@link SCENARIO_TOOLS}. */
export type ScenarioToolName = (typeof SCENARIO_TOOLS)[number];

/** Where the scenario tools get their data; swapped for fakes in tests. */
export interface ScenarioDeps {
  /** The user's cached recipes. */
  readonly rows: () => Promise<readonly Recipe[]>;
  /** The Drive file ids the user has hearted. */
  readonly favouriteIds: () => Promise<readonly string[]>;
  /** Fill the cache from Drive; may throw. */
  readonly sync: () => Promise<unknown>;
  /** Run a promise after the response is sent. */
  readonly inBackground: (work: Promise<unknown>) => void;
}

/** A scenario tool's answer, and whether it is a plain message or a recipe list. */
export interface ScenarioToolResult extends ScenarioResult {
  readonly plain: boolean;
}

/**
 * The user's cached recipes. If the cache is empty (the web app was never
 * opened, or recipes were added in Drive directly) it is filled first and
 * waited for; otherwise it is refreshed after the answer is sent so the next
 * question sees any change.
 */
async function loadRows(deps: ScenarioDeps): Promise<readonly Recipe[]> {
  const rows = await deps.rows();
  if (rows.length > 0) {
    deps.inBackground(deps.sync().catch(() => undefined));
    return rows;
  }
  try {
    await deps.sync();
    return await deps.rows();
  } catch (error) {
    if (error instanceof DriveNotConnectedError) {
      // Nothing to answer from, and the reason matters: say it.
      throw error;
    }
    // Answer from what there is; an empty collection reads as empty.
    return rows;
  }
}

/**
 * Run one of the scenario tools. They answer from the cached recipes (see
 * {@link loadRows} for how the cache is kept fresh).
 */
export async function runScenarioTool(
  name: ScenarioToolName,
  args: Readonly<Record<string, unknown>>,
  deps: ScenarioDeps,
): Promise<ScenarioToolResult> {
  const rows = await loadRows(deps);
  const hearted = new Set(await deps.favouriteIds());
  const recipes = rows.map((r) =>
    toScenarioRecipe(r, hearted.has(r.drive_file_id)),
  );
  switch (name) {
    case 'browse_recipes':
      return { ...browseRecipes(recipes, args), plain: false };
    case 'recipes_from_ingredients':
      return { ...recipesFromIngredients(recipes, args), plain: false };
    default:
      return { ...filterOverview(recipes), plain: true };
  }
}
