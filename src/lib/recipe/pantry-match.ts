/**
 * @packageDocumentation
 *
 * "I have 3 tomatoes and 400 g of pasta — what can I make?" Matching what a
 * person has against the ingredient lists of their recipes.
 *
 * Names are compared loosely: plurals, descriptors ("chopped", "fresh") and
 * regional words (aubergine / eggplant) are smoothed over, any pasta shape
 * counts as pasta, and a processed form is not the raw thing (tomato paste is
 * not a tomato). Where both sides give an amount in comparable units, the
 * amount is checked too, so 400 g of pasta does not cover a recipe that wants
 * 500 g. Salt, pepper, water and cooking oil are assumed to be in the kitchen.
 */

import { foldText } from '../intl';
import { toBaseAmount } from './units';

/** Something the person has, with an amount when they gave one. */
export interface PantryItem {
  name: string;
  quantity?: string;
}

const UNIT_WORDS = new Set([
  'g',
  'gram',
  'grams',
  'kg',
  'kilo',
  'kilos',
  'kilogram',
  'kilograms',
  'mg',
  'oz',
  'ounce',
  'ounces',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'ml',
  'millilitre',
  'millilitres',
  'milliliter',
  'milliliters',
  'l',
  'litre',
  'litres',
  'liter',
  'liters',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'can',
  'cans',
  'tin',
  'tins',
  'clove',
  'cloves',
  'bunch',
  'bunches',
  'packet',
  'packets',
  'pack',
  'packs',
  'bag',
  'bags',
  'jar',
  'jars',
  'slice',
  'slices',
  'piece',
  'pieces',
]);

/**
 * Read a free-text item such as "3 tomatoes", "400 g pasta" or "1 can of
 * chickpeas" into a name and an amount. Plain names ("onions") have no amount.
 */
export function parsePantryItem(text: string): PantryItem {
  const trimmed = text.trim();
  const match =
    /^(\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+|\s*\/\s*\d+)?)\s*(.*)$/.exec(
      trimmed,
    );
  if (!match || !match[2]) {
    return { name: trimmed };
  }
  const amount = match[1]!;
  const words = match[2].trim().split(/\s+/);
  // A leading unit word ("g", "cups", "can") is the unit; otherwise the whole
  // remainder is the name ("3 tomatoes").
  if (words.length > 1 && UNIT_WORDS.has(words[0]!.toLowerCase())) {
    const rest = words
      .slice(1)
      .join(' ')
      .replace(/^of\s+/i, '');
    return { name: rest, quantity: `${amount} ${words[0]}` };
  }
  return { name: words.join(' '), quantity: amount };
}

/** Words that describe an ingredient without changing what it is. */
const DESCRIPTORS = new Set([
  'fresh',
  'chopped',
  'diced',
  'sliced',
  'minced',
  'grated',
  'large',
  'small',
  'medium',
  'ripe',
  'whole',
  'dried',
  'dry',
  'finely',
  'roughly',
  'boneless',
  'skinless',
  'canned',
  'tinned',
  'frozen',
  'raw',
  'cooked',
  'peeled',
  'crushed',
  'of',
  'a',
  'the',
  'and',
  'or',
  'to',
  'taste',
  'optional',
  'extra',
  'good',
  'quality',
]);

/** Words that mean the same thing, mapped to one. */
const SYNONYMS: Record<string, string> = {
  aubergine: 'eggplant',
  courgette: 'zucchini',
  coriander: 'cilantro',
  scallion: 'onion',
  capsicum: 'pepper',
  chilli: 'chili',
  chile: 'chili',
  garbanzo: 'chickpea',
  beetroot: 'beet',
  rocket: 'arugula',
  prawn: 'shrimp',
  spaghetti: 'pasta',
  penne: 'pasta',
  fusilli: 'pasta',
  macaroni: 'pasta',
  linguine: 'pasta',
  rigatoni: 'pasta',
  tagliatelle: 'pasta',
  fettuccine: 'pasta',
  farfalle: 'pasta',
  noodle: 'noodle',
  yoghurt: 'yogurt',
  mince: 'ground',
  minced: 'ground',
};

/** Words that mean it is processed, so it is not the raw ingredient. */
const FORMS = new Set([
  'paste',
  'sauce',
  'puree',
  'stock',
  'broth',
  'powder',
  'juice',
  'flour',
  'oil',
  'milk',
  'cream',
  'extract',
  'vinegar',
  'seasoning',
  'ketchup',
  'soup',
  'noodle',
  'bread',
  'cheese',
  'butter',
  'syrup',
  'zest',
]);

/** Plain-singular form of one word. */
function singular(word: string): string {
  if (word.length <= 3) {
    return word;
  }
  if (word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith('oes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ves')) {
    return `${word.slice(0, -3)}f`;
  }
  if (word.endsWith('ss') || word.endsWith('us')) {
    return word;
  }
  return word.endsWith('s') ? word.slice(0, -1) : word;
}

/** The meaningful words of an ingredient name, singular and with synonyms folded. */
export function ingredientWords(name: string): string[] {
  const words = foldText(name.replace(/\([^)]*\)/g, ' '))
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((w) => singular(w))
    .map((w) => SYNONYMS[w] ?? w)
    .filter((w) => !DESCRIPTORS.has(w));
  return [...new Set(words)];
}

/**
 * Whether what the person has covers what the recipe asks for. Every word of
 * the shorter name must appear in the longer one, and a processed form on only
 * one side ("tomato paste" vs "tomato") is a different thing.
 */
export function sameIngredient(have: string, need: string): boolean {
  const a = ingredientWords(have);
  const b = ingredientWords(need);
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (!small.every((w) => big.includes(w))) {
    return false;
  }
  return !big.some((w) => !small.includes(w) && FORMS.has(w));
}

/** Names assumed to be in any kitchen. */
const STAPLES = [
  'salt',
  'pepper',
  'black pepper',
  'water',
  'oil',
  'olive oil',
  'vegetable oil',
  'cooking oil',
  'ice',
];

/** Whether an ingredient is a kitchen staple. */
export function isStaple(name: string): boolean {
  return (
    STAPLES.some((s) => sameIngredient(s, name)) &&
    !/\b(powder|flake)/i.test(name)
  );
}

/** A recipe's ingredient as the matcher needs it. */
export interface RecipeIngredient {
  name: string;
  quantity: string;
}

/** How a recipe fares against what the person has. */
export interface PantryMatch {
  /** Ingredients the person has, by the recipe's name for them. */
  covered: string[];
  /** Ingredients they lack. */
  missing: string[];
  /** Ingredients they have, but not enough of. */
  short: { name: string; have: string; need: string }[];
  /** How many of the person's own items the recipe uses. */
  used: number;
}

/** Whether `have` is less than `need` when the two can be compared. */
function isShort(have: string | undefined, need: string): boolean {
  if (!have) {
    return false;
  }
  const a = toBaseAmount(have);
  const b = toBaseAmount(need);
  if (!a || !b || a.dimension !== b.dimension) {
    return false;
  }
  if (a.dimension === 'count' && a.unit && b.unit && a.unit !== b.unit) {
    return false;
  }
  return a.amount < b.amount * 0.99;
}

/** Match one recipe's ingredients against the person's items. */
export function matchRecipe(
  ingredients: readonly RecipeIngredient[],
  pantry: readonly PantryItem[],
  options: { assumeStaples?: boolean } = {},
): PantryMatch {
  const assumeStaples = options.assumeStaples ?? true;
  const result: PantryMatch = { covered: [], missing: [], short: [], used: 0 };
  const usedItems = new Set<number>();
  for (const ingredient of ingredients) {
    const index = pantry.findIndex((item) =>
      sameIngredient(item.name, ingredient.name),
    );
    if (index >= 0) {
      usedItems.add(index);
      result.covered.push(ingredient.name);
      const item = pantry[index]!;
      if (item.quantity && isShort(item.quantity, ingredient.quantity)) {
        result.short.push({
          name: ingredient.name,
          have: item.quantity,
          need: ingredient.quantity,
        });
      }
    } else if (!(assumeStaples && isStaple(ingredient.name))) {
      result.missing.push(ingredient.name);
    }
  }
  result.used = usedItems.size;
  return result;
}

/** A recipe with its match, ready to rank. */
export interface RankedMatch<T> {
  recipe: T;
  match: PantryMatch;
}

/**
 * Split matches into what can be cooked now and what is nearly there, best
 * first. A recipe must use at least one of the person's items to count.
 */
export function rankMatches<T>(
  matches: RankedMatch<T>[],
  allowMissing: number,
): { canMake: RankedMatch<T>[]; almost: RankedMatch<T>[] } {
  const usable = matches.filter((m) => m.match.used > 0);
  const gap = (m: RankedMatch<T>) =>
    m.match.missing.length + m.match.short.length;
  const byFit = (a: RankedMatch<T>, b: RankedMatch<T>) =>
    gap(a) - gap(b) || b.match.used - a.match.used;
  return {
    canMake: usable.filter((m) => gap(m) === 0).sort(byFit),
    almost: usable
      .filter((m) => gap(m) > 0 && gap(m) <= allowMissing)
      .sort(byFit),
  };
}
