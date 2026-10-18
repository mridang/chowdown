/**
 * @packageDocumentation
 *
 * The question-shaped MCP tools: "I feel like cooking Indian today" (browse by
 * cuisine, diet, time…) and "I have 3 tomatoes and 400 g of pasta — what can I
 * make?" (match the pantry against the collection). Everything here works on
 * the recipes cached in D1, so it never touches Drive, and it is pure so the
 * wording and ranking can be tested without a server.
 */

import { countOf, foldText, listAnd } from '../intl';
import type { Recipe } from '../db/recipes';
import { parseRecipe } from '../recipe/cooklang';
import { recipeDisplayName } from '../recipe/cook-text';
import { DIET_TYPES } from '../recipe/diet-type';
import { minutesOf } from '../recipe/minutes';
import {
  matchRecipe,
  parsePantryItem,
  rankMatches,
  type PantryItem,
  type PantryMatch,
} from '../recipe/pantry-match';
import { FACETS, facet } from '../recipe/taxonomy';
import { rowTags, type RecipeTags } from '../recipe/tag-index';

/** A cached recipe, parsed once, with what the scenario tools look at. */
export interface ScenarioRecipe {
  id: string;
  /** The name as shown, without `.cook` or the uncurated marker. */
  name: string;
  /** The file name, kept so results can render as a recipe list. */
  filename: string;
  tags: RecipeTags;
  /** Total time in minutes, when the recipe says. */
  minutes?: number;
  ingredients: { name: string; quantity: string }[];
  favourite: boolean;
}

/** Parse a cached row for the scenario tools. */
export function toScenarioRecipe(
  row: Recipe,
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
  message: string;
  recipes: ScenarioRecipe[];
  isError?: boolean;
}

/** The most results a scenario tool returns unless asked for fewer. */
const DEFAULT_LIMIT = 12;

/** A string argument, trimmed; empty when absent or not a string. */
function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** An argument given as one string or a list of them, as a list. */
function strings(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  return list
    .filter((v): v is string => typeof v === 'string')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

/** The result limit asked for, kept within a sensible range. */
function limitOf(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), 50);
}

/** The position of a recipe's eating style in the usual order, for sorting. */
function dietRank(recipe: ScenarioRecipe): number {
  const index = DIET_TYPES.indexOf(
    (recipe.tags['diet_type']?.[0] ?? '') as (typeof DIET_TYPES)[number],
  );
  return index < 0 ? DIET_TYPES.length : index;
}

/** The recipe's eating style, e.g. "Vegetarian". */
function dietOf(recipe: ScenarioRecipe): string {
  return recipe.tags['diet_type']?.[0] ?? 'Unclassified';
}

/** One recipe as a line of text: name, plus the details worth scanning. */
function line(recipe: ScenarioRecipe): string {
  const bits = [
    recipe.tags['cuisine']?.join('/'),
    recipe.minutes ? `${recipe.minutes} min` : undefined,
    recipe.tags['difficulty']?.[0],
  ].filter(Boolean);
  return `- ${recipe.name}${bits.length ? ` (${bits.join(', ')})` : ''}`;
}

/** Recipes grouped under their eating style, in the usual order. */
function groupedByDiet(recipes: ScenarioRecipe[]): string {
  const sorted = [...recipes].sort(
    (a, b) => dietRank(a) - dietRank(b) || a.name.localeCompare(b.name),
  );
  const out: string[] = [];
  let current = '';
  for (const recipe of sorted) {
    const diet = dietOf(recipe);
    if (diet !== current) {
      current = diet;
      out.push(`\n${diet}:`);
    }
    out.push(line(recipe));
  }
  return out.join('\n').trim();
}

/** The values of a facet argument that the taxonomy knows, or an error line. */
function facetWanted(
  key: string,
  raw: unknown,
): { wanted: string[]; problem?: string } {
  const wanted = strings(raw);
  const f = facet(key);
  if (!f || !f.values || wanted.length === 0) {
    return { wanted };
  }
  const known = new Map(f.values.map((v) => [foldText(v), v]));
  const unknown = wanted.filter((w) => !known.has(foldText(w)));
  if (unknown.length > 0) {
    return {
      wanted: [],
      problem: `${f.label}: "${unknown.join('", "')}" isn't one of ${listAnd(f.values)}.`,
    };
  }
  return { wanted: wanted.map((w) => known.get(foldText(w))!) };
}

/** Whether a recipe carries any of the wanted values for a facet. */
function hasAny(
  recipe: ScenarioRecipe,
  key: string,
  wanted: string[],
): boolean {
  if (wanted.length === 0) {
    return true;
  }
  const have = (recipe.tags[key] ?? []).map(foldText);
  return wanted.some((w) => have.includes(foldText(w)));
}

/** The facets the browse tool takes, as tool-argument names. */
const BROWSE_FACETS = [
  'cuisine',
  'protein',
  'diet_type',
  'diet',
  'category',
  'method',
  'difficulty',
] as const;

/**
 * "What could I cook?" by cuisine, eating style, protein, time and so on.
 * Results come back grouped by eating style, vegan first.
 */
export function browseRecipes(
  recipes: ScenarioRecipe[],
  args: Record<string, unknown>,
): ScenarioResult {
  const wanted: Record<string, string[]> = {};
  for (const key of BROWSE_FACETS) {
    const { wanted: values, problem } = facetWanted(key, args[key]);
    if (problem) {
      return { message: problem, recipes: [], isError: true };
    }
    wanted[key] = values;
  }
  const maxMinutes =
    typeof args['max_minutes'] === 'number' ? args['max_minutes'] : undefined;
  const query = foldText(str(args['query']));
  const favouritesOnly = args['favourites_only'] === true;

  const hits = recipes.filter(
    (r) =>
      BROWSE_FACETS.every((key) => hasAny(r, key, wanted[key]!)) &&
      (maxMinutes === undefined ||
        (r.minutes !== undefined && r.minutes <= maxMinutes)) &&
      (!favouritesOnly || r.favourite) &&
      (!query || foldText(r.name).includes(query)),
  );

  const asked = BROWSE_FACETS.flatMap((key) => wanted[key]!);
  const what = [
    ...asked,
    maxMinutes !== undefined ? `within ${maxMinutes} minutes` : '',
    favouritesOnly ? 'favourites' : '',
    query ? `matching "${str(args['query'])}"` : '',
  ].filter(Boolean);
  const subject = what.length ? ` for ${what.join(', ')}` : '';

  // Recipes that don't say how long they take can't be matched to a time limit.
  const untimed =
    maxMinutes === undefined
      ? 0
      : recipes.filter(
          (r) =>
            r.minutes === undefined &&
            BROWSE_FACETS.every((key) => hasAny(r, key, wanted[key]!)),
        ).length;
  const untimedNote = untimed
    ? `\n\n(${countOf(untimed, 'other recipe')} fit${untimed === 1 ? 's' : ''} the rest but ${untimed === 1 ? "doesn't" : "don't"} say how long ${untimed === 1 ? 'it takes' : 'they take'}.)`
    : '';

  if (hits.length === 0) {
    return {
      message:
        `No recipes${subject}. Use list_filters to see what the collection holds` +
        ' — or offer to import one.' +
        untimedNote,
      recipes: [],
    };
  }
  const shown = hits
    .sort((a, b) => dietRank(a) - dietRank(b) || a.name.localeCompare(b.name))
    .slice(0, limitOf(args['limit']));
  const more =
    hits.length > shown.length
      ? ` (showing ${shown.length} of ${hits.length})`
      : '';
  return {
    message: `${countOf(hits.length, 'recipe')}${subject}${more}:\n\n${groupedByDiet(shown)}${untimedNote}`,
    recipes: shown,
  };
}

/** The pantry items asked for: strings like "3 tomatoes", or {name, quantity}. */
export function pantryOf(value: unknown): PantryItem[] {
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  const items: PantryItem[] = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      // "3 tomatoes and 400 g pasta" in one string is common from a model.
      for (const part of entry.split(/,|\band\b|&/i)) {
        if (part.trim()) {
          items.push(parsePantryItem(part.trim()));
        }
      }
    } else if (entry && typeof entry === 'object') {
      const { name, quantity } = entry as Record<string, unknown>;
      if (typeof name === 'string' && name.trim()) {
        items.push(
          typeof quantity === 'string' || typeof quantity === 'number'
            ? { name: name.trim(), quantity: String(quantity).trim() }
            : { name: name.trim() },
        );
      }
    }
  }
  return items.filter((i) => i.name);
}

/** What stands between the person and cooking this, in a few words. */
function gapText(match: PantryMatch, listUpTo = Infinity): string {
  const parts: string[] = [];
  if (match.missing.length) {
    const shown = match.missing.slice(0, listUpTo);
    const rest = match.missing.length - shown.length;
    parts.push(
      `missing ${listAnd(shown)}${rest > 0 ? ` and ${rest} more` : ''}`,
    );
  }
  for (const s of match.short) {
    parts.push(`need more ${s.name} (have ${s.have}, need ${s.need})`);
  }
  return parts.join('; ');
}

/**
 * "I have 3 tomatoes and 400 g of pasta — what can I make?" Splits the
 * collection into what can be cooked now and what is a few items short.
 */
export function recipesFromIngredients(
  recipes: ScenarioRecipe[],
  args: Record<string, unknown>,
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
  const allowMissing =
    typeof args['allow_missing'] === 'number'
      ? Math.max(0, Math.floor(args['allow_missing']))
      : 2;
  const assumeStaples = args['assume_staples'] !== false;
  const { wanted: diets, problem } = facetWanted(
    'diet_type',
    args['diet_type'],
  );
  if (problem) {
    return { message: problem, recipes: [], isError: true };
  }

  const matches = recipes
    .filter((r) => hasAny(r, 'diet_type', diets))
    .map((recipe) => ({
      recipe,
      match: matchRecipe(recipe.ingredients, pantry, { assumeStaples }),
    }));
  const ranked = rankMatches(matches, allowMissing);
  const limit = limitOf(args['limit']);
  const canMake = ranked.canMake.slice(0, limit);
  const almost = ranked.almost.slice(0, limit);
  const have = listAnd(
    pantry.map((p) => (p.quantity ? `${p.quantity} ${p.name}` : p.name)),
  );

  if (canMake.length === 0 && almost.length === 0) {
    // Nothing is within reach, so show what comes closest rather than a dead end.
    const closest = rankMatches(matches, Infinity).almost.slice(
      0,
      Math.min(limit, 5),
    );
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
        `Nothing is within ${countOf(allowMissing, 'item')} of ${have}. The closest, which need a shop:\n` +
        closest
          .map(
            ({ recipe, match }) =>
              `${line(recipe)} — ${dietOf(recipe)}; ${gapText(match, 4)}`,
          )
          .join('\n'),
      recipes: closest.map((m) => m.recipe),
    };
  }

  const sections: string[] = [`With ${have}:`];
  if (canMake.length) {
    sections.push(
      `\nYou can make now (${canMake.length}):\n` +
        canMake
          .map(
            ({ recipe, match }) =>
              `${line(recipe)} — ${dietOf(recipe)}; uses ${match.used} of your ${pantry.length}`,
          )
          .join('\n'),
    );
  }
  if (almost.length) {
    sections.push(
      `\nAlmost there (${almost.length}):\n` +
        almost
          .map(
            ({ recipe, match }) =>
              `${line(recipe)} — ${dietOf(recipe)}; ${gapText(match)}`,
          )
          .join('\n'),
    );
  }
  return {
    message: sections.join('\n'),
    recipes: [...canMake, ...almost].map((m) => m.recipe),
  };
}

/** The values each facet holds in the collection, with counts. */
export function filterOverview(recipes: ScenarioRecipe[]): ScenarioResult {
  if (recipes.length === 0) {
    return { message: 'No recipes yet.', recipes: [] };
  }
  const lines = [`${countOf(recipes.length, 'recipe')} saved.`];
  for (const f of FACETS) {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      for (const v of r.tags[f.key] ?? []) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    if (counts.size === 0) {
      continue;
    }
    // Eating styles keep their usual order; the rest go most common first.
    const entries = [...counts].sort(([a, x], [b, y]) =>
      f.key === 'diet_type'
        ? DIET_TYPES.indexOf(a as (typeof DIET_TYPES)[number]) -
          DIET_TYPES.indexOf(b as (typeof DIET_TYPES)[number])
        : y - x || a.localeCompare(b),
    );
    lines.push(
      `\n${f.label} (${f.key}): ${entries.map(([v, n]) => `${v} ${n}`).join(', ')}`,
    );
  }
  return { message: lines.join('\n'), recipes: [] };
}
