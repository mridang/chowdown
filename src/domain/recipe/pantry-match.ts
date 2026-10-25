/**
 * @packageDocumentation
 *
 * "I have 3 tomatoes and 400 g of pasta — what can I make?" Matching what a
 * person has against the ingredient lists of their recipes.
 *
 * Names are compared loosely: plurals, descriptors ("chopped", "fresh") and
 * regional words (aubergine / eggplant) are smoothed over, any pasta shape
 * counts as pasta, and a processed form or a different product is not the raw
 * thing (tomato paste is not a tomato, coconut milk is not milk). Where both
 * sides give an amount in comparable units, the amount is checked too, so 400 g
 * of pasta does not cover a recipe that wants 500 g. Salt, pepper, water and
 * cooking oil are assumed to be in the kitchen.
 */

import { foldText } from '@/lib/intl';
import { toBaseAmount, type BaseAmount } from '@/lib/cooklang';
import { own } from '@/utils/own';

/** Something the person has, with an amount when they gave one. */
export interface PantryItem {
  readonly name: string;
  readonly quantity?: string;
}

/** Words that name a unit or a container rather than the thing itself. */
const UNIT_WORDS = new Set([
  ...['g', 'gr', 'gm', 'gms', 'gram', 'grams', 'mg', 'kg', 'kgs', 'kilo'],
  ...['kilos', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'lbs'],
  ...['pound', 'pounds', 'ml', 'millilitre', 'millilitres', 'milliliter'],
  ...['milliliters', 'l', 'litre', 'litres', 'liter', 'liters', 'dl', 'cl'],
  ...['cup', 'cups', 'tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons'],
  ...['tsp', 'tsps', 'teaspoon', 'teaspoons', 'pint', 'pints', 'pt', 'quart'],
  ...['quarts', 'qt', 'can', 'cans', 'tin', 'tins', 'clove', 'cloves'],
  ...['bunch', 'bunches', 'packet', 'packets', 'pack', 'packs', 'bag', 'bags'],
  ...['jar', 'jars', 'slice', 'slices', 'piece', 'pieces', 'pc', 'pcs'],
  ...['stick', 'sticks', 'head', 'heads', 'bulb', 'bulbs', 'bottle', 'bottles'],
  ...['loaf', 'loaves', 'carton', 'cartons', 'dozen', 'pinch', 'handful'],
  ...['sprig', 'sprigs', 'stalk', 'stalks', 'knob', 'dash', 'box', 'boxes'],
]);

/** Whether a word is a unit or container ("g", "cups", "tin"). */
export function isUnitWord(word: string): boolean {
  return UNIT_WORDS.has(word.replace(/\.$/, '').toLowerCase());
}

/** Containers: "2 x 400g tins of tomatoes" is 800 g of tomatoes. */
const CONTAINERS = new Set([
  ...['can', 'cans', 'tin', 'tins', 'packet', 'packets', 'pack', 'packs'],
  ...['bag', 'bags', 'jar', 'jars', 'bottle', 'bottles', 'carton', 'cartons'],
  ...['box', 'boxes'],
]);

/** The number words people type for small counts. */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** A number as people write it: 3, 1.5, 1,5, 1,000, 1/2, 1 1/2, ½, 1½. */
const NUM =
  String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d*\s*[½⅓⅔¼¾⅛⅜⅝⅞]|` +
  String.raw`\d+(?:[.,]\d+)?(?:\s+\d+\s*/\s*\d+|\s*/\s*\d+)?`;

/** Say "half a dozen" and "two" the way a number would be written. */
function numberFromWords(text: string): string {
  return text
    .replace(/^half an? dozen\b/i, '6')
    .replace(/^an? dozen\b/i, '12')
    .replace(/^half an? /i, '0.5 ')
    .replace(/^(?:an?|one)\s+(?=([a-z]+)\b)/i, (whole, unit: string) =>
      UNIT_WORDS.has(unit.toLowerCase()) && !/^dozen/i.test(unit)
        ? '1 '
        : whole,
    )
    .replace(
      /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
      (_, word: string) => String(own(NUMBER_WORDS, word.toLowerCase())),
    );
}

/** A unit word without its full stop, lower-cased. */
function unitWord(word: string): string {
  return word.replace(/\.$/, '').toLowerCase();
}

/** The leading amount and unit of a pantry string, and what's left as the name. */
function leadingAmount(
  text: string,
): { quantity: string; name: string } | undefined {
  // "2 x 400g tins of tomatoes": a count of sized packs.
  const packs = new RegExp(
    `^(\\d+)\\s*[x×]\\s*(${NUM})\\s*([a-zA-Z]+\\.?)?\\s*(.*)$`,
  ).exec(text);
  if (packs) {
    const size = (packs[2] ?? '').trim();
    const unit = unitWord(packs[3] ?? '');
    const total = Number(packs[1]) * Number(size.replace(',', '.'));
    if (UNIT_WORDS.has(unit) && Number.isFinite(total)) {
      return {
        quantity: `${total} ${unit}`,
        name: withoutContainer(packs[4] ?? ''),
      };
    }
  }
  const lead = new RegExp(`^(${NUM})\\s*(.*)$`).exec(text);
  if (!lead || !lead[2]) {
    return undefined;
  }
  const amount = (lead[1] ?? '').trim();
  const words = lead[2].trim().split(/\s+/);
  const [firstWord = ''] = words;
  if (words.length > 1 && UNIT_WORDS.has(unitWord(firstWord))) {
    const rest = words.slice(1).join(' ');
    return {
      quantity: `${amount} ${unitWord(firstWord)}`,
      name: rest.replace(/^of\s+/i, ''),
    };
  }
  // "3x tomato" is three tomatoes
  return { quantity: amount, name: words.join(' ').replace(/^[x×]\s*/i, '') };
}

/** "tins of tomatoes" → "tomatoes". */
function withoutContainer(text: string): string {
  const words = text.trim().split(/\s+/);
  const rest =
    words.length > 1 && CONTAINERS.has(unitWord(words[0] ?? ''))
      ? words.slice(1).join(' ')
      : text.trim();
  return rest.replace(/^of\s+/i, '');
}

/**
 * Read a free-text item such as "3 tomatoes", "400g pasta", "1 can of
 * chickpeas", "a dozen eggs" or "tomatoes (3)" into a name and an amount. Plain
 * names ("onions") have no amount. Text with no name in it gives an empty name.
 */
export function parsePantryItem(text: string): PantryItem {
  const trimmed = text.trim();
  const spoken = numberFromWords(trimmed);
  const leading = leadingAmount(spoken);
  if (leading) {
    return leading.name
      ? { name: leading.name, quantity: leading.quantity }
      : { name: '' };
  }
  // "tomatoes (3)" and "Tomatoes, 3": the amount after the name.
  const after = new RegExp(
    `^(.+?)\\s*(?:\\(\\s*(${NUM})\\s*\\)|,\\s*(${NUM}))$`,
  ).exec(trimmed);
  if (after) {
    return {
      name: (after[1] ?? '').trim(),
      quantity: (after[2] ?? after[3] ?? '').trim(),
    };
  }
  return { name: /[a-z]/i.test(trimmed) ? trimmed : '' };
}

/** Words that describe an ingredient without changing what it is. */
const DESCRIPTORS = new Set([
  ...['fresh', 'chopped', 'diced', 'sliced', 'minced', 'grated', 'large'],
  ...['small', 'medium', 'ripe', 'whole', 'dried', 'dry', 'finely', 'roughly'],
  ...['boneless', 'skinless', 'canned', 'tinned', 'frozen', 'raw', 'cooked'],
  ...['peeled', 'crushed', 'of', 'a', 'the', 'and', 'or', 'to', 'taste'],
  ...['optional', 'extra', 'good', 'quality', 'plain', 'unsalted', 'salted'],
]);

/** Words that mean the same thing, mapped to one. */
const SYNONYMS: Readonly<Record<string, string>> = {
  aubergine: 'eggplant',
  courgette: 'zucchini',
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
  yoghurt: 'yogurt',
  soya: 'soy',
  scallion: 'scallion',
};

/**
 * Words that say what a thing is without being named: "cheddar" is a cheese and
 * "ramen" is a noodle, so each side of a comparison gains the word it implies
 * and "cheddar" meets "cheddar cheese".
 */
const IMPLIES: Readonly<Record<string, string>> = {
  cheddar: 'cheese',
  parmesan: 'cheese',
  mozzarella: 'cheese',
  feta: 'cheese',
  ricotta: 'cheese',
  gouda: 'cheese',
  brie: 'cheese',
  ramen: 'noodle',
  udon: 'noodle',
  soba: 'noodle',
  vermicelli: 'noodle',
  vanilla: 'extract',
};

/**
 * Words that, on one side only, make it a different thing: a processed form
 * ("tomato paste"), a different product ("coconut milk", "peanut butter",
 * "rice paper") or a different part of the plant ("banana leaf"). Most
 * qualifiers are harmless ("flour tortillas" are still tortillas), so this lists
 * only the ones that change what you would buy.
 */
const DIFFERENT_THING = new Set([
  ...[
    'paste',
    'sauce',
    'puree',
    'stock',
    'broth',
    'powder',
    'juice',
    'extract',
  ],
  ...[
    'vinegar',
    'seasoning',
    'ketchup',
    'soup',
    'syrup',
    'zest',
    'oil',
    'cube',
  ],
  ...['dressing', 'mix', 'wine', 'paper', 'chip', 'leaf', 'chestnut', 'tartar'],
  ...['chocolate', 'bean', 'green', 'krispie', 'noodle', 'sprout', 'flake'],
  ...['coconut', 'almond', 'soy', 'oat', 'cashew', 'peanut', 'hazelnut'],
  ...['macadamia', 'sweet', 'sun', 'cauliflower', 'condensed', 'evaporated'],
  ...[
    'smoked',
    'pickled',
    'tortilla',
    'pepper',
    'jack',
    'cod',
    'butter',
    'milk',
    'cream',
  ],
]);

/** Plurals that don't follow the rules. */
const IRREGULAR: Readonly<Record<string, string>> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  anchovies: 'anchovy',
};

/**
 * One word reduced to a form shared by its singular and plural, so "clove" and
 * "cloves", "chilies" and "chili", "radishes" and "radish" all meet.
 */
function stem(word: string): string {
  const w = singular(own(IRREGULAR, word) ?? word);
  // chili / chilli / chilly and cookie / cooky all end the same way
  return w.length > 3 && /(?:ie|y)$/.test(w) ? w.replace(/(?:ie|y)$/, 'i') : w;
}

/** A word with a regular plural ending taken off, if it has one. */
function singular(w: string): string {
  if (w.length <= 3) {
    return w;
  }
  if (w.endsWith('ies') && w.length > 4) {
    return `${w.slice(0, -3)}y`;
  }
  if (/(?:ch|sh|x|z|ss|o)es$/.test(w)) {
    return w.slice(0, -2);
  }
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) {
    return w; // "molasses", "hummus", "asparagus" are already singular
  }
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

/** Meats that turn "mince" into ground meat. */
const MEATS: ReadonlySet<string> = new Set([
  'beef',
  'pork',
  'lamb',
  'chicken',
  'turkey',
  'mutton',
]);

/** Spring and green onions are scallions, not onions. */
function withScallions(words: readonly string[]): readonly string[] {
  return words.includes('onion') &&
    (words.includes('spring') || words.includes('green'))
    ? [
        ...words.filter((w) => !['onion', 'spring', 'green'].includes(w)),
        'scallion',
      ]
    : words;
}

/**
 * Coriander on its own is the herb, but "ground coriander" and the seeds are
 * the spice.
 */
function withHerbCoriander(words: readonly string[]): readonly string[] {
  const isSpice = ['seed', 'ground', 'powder'].some((w) => words.includes(w));
  return words.includes('coriander') && !isSpice
    ? words.map((w) => (w === 'coriander' ? 'cilantro' : w))
    : words;
}

/** Mince is ground meat; on its own it stays "mince". */
function withGroundMeat(words: readonly string[]): readonly string[] {
  return words.includes('mince') && words.some((w) => MEATS.has(w))
    ? words.map((w) => (w === 'mince' ? 'ground' : w))
    : words;
}

/** Each word followed by the word it implies ("cheddar" also says "cheese"). */
function withImplied(words: readonly string[]): readonly string[] {
  return [
    ...words,
    ...words.flatMap((w) => {
      const implied = own(IMPLIES, w);
      return implied ? [implied] : [];
    }),
  ];
}

/** The meaningful words of an ingredient name: singular, synonyms folded. */
export function ingredientWords(name: string): readonly string[] {
  const words = foldText(name.replace(/\([^)]*\)/g, ' '))
    .split(/[^a-z]+/)
    .filter((w) => w && !DESCRIPTORS.has(w))
    .map((w) => stem(w))
    .map((w) => stem(own(SYNONYMS, w) ?? w))
    .filter((w) => !DESCRIPTORS.has(w));
  return [
    ...new Set(
      withImplied(withGroundMeat(withHerbCoriander(withScallions(words)))),
    ),
  ];
}

/**
 * Whether what the person has covers what the recipe asks for. Every word of
 * the shorter name must appear in the longer one, so a general item ("cheese")
 * covers a specific one ("cheddar"), but an extra word that makes it a
 * different thing ("tomato" vs "tomato paste") does not.
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
  const extra = big.filter((w) => !small.includes(w));
  // Cream cheese is not cream, whichever way round.
  if (small.includes('cream') && extra.includes('cheese')) {
    return false;
  }
  return !extra.some((w) => DIFFERENT_THING.has(w));
}

/** Words an ingredient may be made of and still be a kitchen staple. */
const STAPLE_WORDS = new Set([
  ...['salt', 'pepper', 'water', 'oil', 'ice', 'and', 'or', 'a', 'to', 'for'],
  ...['kosher', 'sea', 'table', 'fine', 'coarse', 'ground', 'black', 'white'],
  ...['freshly', 'extra', 'virgin', 'light', 'neutral', 'cooking', 'olive'],
  ...[
    'vegetable',
    'cold',
    'hot',
    'warm',
    'boiling',
    'filtered',
    'tap',
    'taste',
  ],
  ...['seasoning', 'frying', 'pinch', 'of', 'some', 'the', 'ground'],
]);

/**
 * Whether an ingredient is a kitchen staple: salt, pepper, water, plain
 * cooking oil or ice, by the whole name. Bell peppers, salt cod, sesame oil and
 * coconut water are not, and neither are pepper flakes or garlic powder.
 */
export function isStaple(name: string): boolean {
  const words = foldText(name.replace(/\([^)]*\)/g, ' '))
    .split(/[^a-z]+/)
    .filter(Boolean);
  return (
    words.length > 0 &&
    words.every((w) => STAPLE_WORDS.has(w)) &&
    words.some((w) => ['salt', 'pepper', 'water', 'oil', 'ice'].includes(w))
  );
}

/** A recipe's ingredient as the matcher needs it. */
export interface RecipeIngredient {
  readonly name: string;
  readonly quantity: string;
}

/** An ingredient the person has some of, but less than the recipe wants. */
export interface ShortIngredient {
  readonly name: string;
  readonly have: string;
  readonly need: string;
}

/** How a recipe fares against what the person has. */
export interface PantryMatch {
  /** Ingredients the person has, by the recipe's name for them. */
  readonly covered: readonly string[];
  /** Ingredients they lack. */
  readonly missing: readonly string[];
  /** Ingredients they have, but not enough of. */
  readonly short: readonly ShortIngredient[];
  /** How many of the person's own items the recipe uses. */
  readonly used: number;
}

/** Whether two amounts count the same thing and so can be added or compared. */
function comparable(a: BaseAmount, b: BaseAmount): boolean {
  if (a.dimension !== b.dimension) {
    return false;
  }
  if (a.dimension !== 'count') {
    return true;
  }
  // Counts compare only when both are plain, or both count the same thing:
  // "1 head" of garlic is not "4 cloves", and "3" is not "3 cans".
  return stem(a.unit ?? '') === stem(b.unit ?? '');
}

/** An amount as text, for messages: "800 g", "3 cloves". */
function describeAmount(amount: BaseAmount): string {
  const n = Math.round(amount.amount * 100) / 100;
  const unit =
    amount.dimension === 'mass'
      ? 'g'
      : amount.dimension === 'volume'
        ? 'ml'
        : amount.unit;
  return unit ? `${n} ${unit}` : String(n);
}

/** The sum of amounts that can be added, or undefined if any can't. */
function total(amounts: readonly BaseAmount[]): BaseAmount | undefined {
  const [first, ...rest] = amounts;
  if (!first || rest.some((a) => !comparable(first, a))) {
    return undefined;
  }
  return { ...first, amount: amounts.reduce((sum, a) => sum + a.amount, 0) };
}

/** How alike two names are, 0 to 1, so the best pantry item can be preferred. */
function similarity(a: string, b: string): number {
  const x = ingredientWords(a);
  const y = ingredientWords(b);
  const shared = x.filter((w) => y.includes(w)).length;
  return shared / new Set([...x, ...y]).size;
}

/** What matching one (possibly repeated) recipe ingredient came to. */
type IngredientOutcome =
  | { readonly kind: 'missing'; readonly name: string }
  | { readonly kind: 'staple' }
  | {
      readonly kind: 'covered';
      readonly name: string;
      /** Which of the person's items covered it, by position. */
      readonly itemIndexes: readonly number[];
      readonly short?: ShortIngredient;
    };

/** A pantry item that has an amount, with that amount already parsed. */
interface MeasuredItem {
  readonly quantity: string;
  readonly amount: BaseAmount;
}

/**
 * Whether the person has enough of an ingredient, given the items that cover
 * it: their amounts are added up (when they said how much) and compared with
 * everything the recipe wants of it. Returns what is short, or undefined when
 * there is enough or the amounts can't be compared.
 */
function shortfall(
  lines: readonly RecipeIngredient[],
  first: RecipeIngredient,
  matching: readonly PantryItem[],
): ShortIngredient | undefined {
  // A recipe that lists tomatoes twice needs both amounts.
  const needs = lines.flatMap((l) => {
    const amount = toBaseAmount(l.quantity);
    return amount ? [amount] : [];
  });
  const need = needs.length === lines.length ? total(needs) : undefined;
  const measured = matching
    .flatMap((item) =>
      item.quantity ? [{ item, quantity: item.quantity }] : [],
    )
    .toSorted(
      (p, q) =>
        similarity(q.item.name, first.name) -
        similarity(p.item.name, first.name),
    )
    .flatMap((h): readonly MeasuredItem[] => {
      const amount = toBaseAmount(h.quantity);
      return amount ? [{ quantity: h.quantity, amount }] : [];
    });
  const usable = measured.filter((h) => need && comparable(h.amount, need));
  const have = total(usable.map((h) => h.amount));
  if (!need || !have || have.amount >= need.amount * 0.99) {
    return undefined;
  }
  return {
    name: first.name,
    have: usable.map((h) => h.quantity).join(' + '),
    need: lines.length === 1 ? first.quantity : describeAmount(need),
  };
}

/** Match one ingredient, listed on one or more lines, against the pantry. */
function matchIngredient(
  lines: readonly RecipeIngredient[],
  pantry: readonly PantryItem[],
  assumeStaples: boolean,
): IngredientOutcome {
  const [first] = lines;
  if (!first) {
    return { kind: 'staple' };
  }
  const matching = pantry
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => sameIngredient(item.name, first.name));
  if (matching.length === 0) {
    return assumeStaples && isStaple(first.name)
      ? { kind: 'staple' }
      : { kind: 'missing', name: first.name };
  }
  const short = shortfall(
    lines,
    first,
    matching.map(({ item }) => item),
  );
  return {
    kind: 'covered',
    name: first.name,
    itemIndexes: matching.map(({ index }) => index),
    ...(short ? { short } : {}),
  };
}

/** Match one recipe's ingredients against the person's items. */
export function matchRecipe(
  ingredients: readonly RecipeIngredient[],
  pantry: readonly PantryItem[],
  options: Readonly<{ assumeStaples?: boolean }> = {},
): PantryMatch {
  const assumeStaples = options.assumeStaples ?? true;
  // The same ingredient listed twice (in any word order) is one ingredient.
  const groups = Map.groupBy(
    ingredients,
    (ingredient) =>
      ingredientWords(ingredient.name).toSorted().join(' ') || ingredient.name,
  );
  const outcomes = [...groups.values()].map((lines) =>
    matchIngredient(lines, pantry, assumeStaples),
  );
  const covered = outcomes.flatMap((o) => (o.kind === 'covered' ? [o] : []));
  return {
    covered: covered.map((o) => o.name),
    missing: outcomes.flatMap((o) => (o.kind === 'missing' ? [o.name] : [])),
    short: covered.flatMap((o) => (o.short ? [o.short] : [])),
    used: new Set(covered.flatMap((o) => o.itemIndexes)).size,
  };
}

/** A recipe with its match, ready to rank. */
export interface RankedMatch<T> {
  readonly recipe: T;
  readonly match: PantryMatch;
}

/**
 * Split matches into what can be cooked now and what is nearly there, best
 * first. A recipe must use at least one of the person's items to count.
 */
export function rankMatches<T>(
  matches: readonly RankedMatch<T>[],
  allowMissing: number,
): {
  readonly canMake: readonly RankedMatch<T>[];
  readonly almost: readonly RankedMatch<T>[];
} {
  const usable = matches.filter((m) => m.match.used > 0);
  const gap = (m: RankedMatch<T>) =>
    m.match.missing.length + m.match.short.length;
  const byFit = (a: RankedMatch<T>, b: RankedMatch<T>) =>
    gap(a) - gap(b) || b.match.used - a.match.used;
  return {
    canMake: usable.filter((m) => gap(m) === 0).toSorted(byFit),
    almost: usable
      .filter((m) => gap(m) > 0 && gap(m) <= allowMissing)
      .toSorted(byFit),
  };
}
