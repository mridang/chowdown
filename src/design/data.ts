/**
 * @packageDocumentation
 *
 * Where the design sandbox gets its recipes. If `real-recipes.local.json` exists
 * (a gitignored export of the developer's own recipes, with their real cover
 * photos) the sandbox shows those; otherwise it falls back to the sample data in
 * `fixtures.ts`. The export never gets committed.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { stepText } from '@/lib/api/recipe-resource';
import { compareText } from '@/lib/intl';
import { extractNotes, type Note } from '@/lib/recipe/cook-text';
import { parseRecipe } from '@/lib/recipe/cooklang';
import { extractMedia } from '@/lib/recipe/media';

import { RECIPES, RECIPE_PAGE, type SampleRecipe, type Tone } from './fixtures';

/** The shape of one entry in the local export. */
interface LocalRecipe {
  id: string;
  title: string;
  cover: string;
  site: string;
  cuisine: string;
  protein: string;
  difficulty: string;
  category: string;
  diet: string[];
  method: string[];
  keywords: string[];
  minutes: number;
  servings: number;
  favourite: boolean;
  cooklang: string;
}

const TONES: Tone[] = ['flame', 'marigold', 'forest', 'sand', 'ink'];

/** A stable tone for a recipe, so its placeholder colour doesn't change. */
function toneFor(text: string): Tone {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return TONES[hash % TONES.length]!;
}

/** The local export, or undefined if there isn't one. */
function readLocal(): LocalRecipe[] | undefined {
  const file = path.join(process.cwd(), 'src/design/real-recipes.local.json');
  if (!existsSync(file)) {
    return undefined;
  }
  return JSON.parse(readFileSync(file, 'utf8')) as LocalRecipe[];
}

function difficultyOf(value: string): SampleRecipe['difficulty'] {
  return value === 'Hard' || value === 'Medium' ? value : 'Easy';
}

/**
 * Tidy a scraped page title for display: sites often append their own name or a
 * tagline ("Chicken Chettinad | Chettinad Chicken Recipe"), so keep the part
 * before the first separator.
 */
export function cleanTitle(title: string): string {
  return title.split(/\s+[|–—]\s+/)[0]!.trim() || title;
}

/** All recipes for the sandbox, sorted by title. */
export function loadRecipes(): SampleRecipe[] {
  const local = readLocal();
  if (!local) {
    return RECIPES;
  }
  return local
    .map((r) => ({
      id: r.id,
      title: cleanTitle(r.title),
      site: r.site,
      minutes: r.minutes,
      servings: r.servings,
      difficulty: difficultyOf(r.difficulty),
      cuisine: r.cuisine,
      protein: r.protein,
      category: r.category,
      diet: r.diet,
      method: r.method,
      keywords: r.keywords,
      favourite: r.favourite,
      tone: toneFor(r.id),
      cover: r.cover,
      cooklang: r.cooklang,
    }))
    .sort((a, b) => compareText(a.title, b.title));
}

/** What the recipe screen shows. */
export interface RecipePageData {
  id?: string;
  favourite: boolean;
  title: string;
  site: string;
  intro: string;
  minutes: number;
  servings: number;
  difficulty: string;
  cuisine: string;
  protein: string;
  category: string;
  diet: string[];
  method: string[];
  keywords: string[];
  notes: Note[];
  tags: string[];
  cover?: string;
  ingredients: [string, string][];
  cookware: string[];
  steps: string[];
}

/** Build the recipe screen's data from one recipe's Cooklang. */
function pageFrom(recipe: SampleRecipe): RecipePageData | undefined {
  if (!recipe.cooklang) {
    return undefined;
  }
  const parsed = parseRecipe(recipe.cooklang, recipe.title);
  const meta = (key: string) =>
    parsed.metadata.find(([k]) => k.toLowerCase() === key)?.[1];
  return {
    id: recipe.id,
    favourite: recipe.favourite,
    title: cleanTitle(parsed.title || recipe.title),
    site: recipe.site,
    intro: meta('description') ?? '',
    minutes: recipe.minutes,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    cuisine: recipe.cuisine,
    protein: recipe.protein,
    category: recipe.category,
    diet: recipe.diet,
    method: recipe.method,
    keywords: recipe.keywords,
    notes: extractNotes(recipe.cooklang),
    tags: [recipe.cuisine, recipe.protein, recipe.difficulty],
    cover: extractMedia(parsed).cover ?? recipe.cover,
    ingredients: parsed.ingredients.map((i) => [i.quantity, i.name]),
    cookware: parsed.cookware,
    steps: parsed.steps.map(stepText).filter(Boolean),
  };
}

/**
 * The recipe for the recipe screen: the one asked for by id, otherwise the first
 * real recipe with a photo, a good ingredient list and a proper method.
 */
export function loadRecipePage(id?: string): RecipePageData {
  const recipes = loadRecipes();
  const wanted = id ? recipes.find((r) => r.id === id) : undefined;
  const good = recipes.find((r) => {
    const page = pageFrom(r);
    return (
      page && page.ingredients.length >= 6 && page.steps.length >= 4 && r.cover
    );
  });
  const chosen = wanted ?? good;
  const page = chosen ? pageFrom(chosen) : undefined;
  if (page) {
    return page;
  }
  return {
    ...RECIPE_PAGE,
    favourite: false,
    cuisine: 'Mexican',
    protein: 'chicken',
    category: 'Main',
    diet: [],
    method: ['Stovetop'],
    keywords: [],
    notes: [],
    tags: [...RECIPE_PAGE.tags],
  };
}

/** Facet groups (value and count, most common first) built from a recipe list. */
export function facetsOf(recipes: SampleRecipe[]) {
  const count = (pick: (r: SampleRecipe) => string): [string, number][] => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      const key = pick(r);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || compareText(a[0], b[0]),
    );
  };
  return {
    protein: count((r) => r.protein),
    cuisine: count((r) => r.cuisine),
    difficulty: count((r) => r.difficulty),
    sources: count((r) => r.site).filter(([, n]) => n >= 2),
  };
}
