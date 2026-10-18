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

import { foldText } from '../intl';
import { toBaseAmount, type BaseAmount } from './units';

/** Something the person has, with an amount when they gave one. */
export interface PantryItem {
  name: string;
  quantity?: string;
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

const NUMBER_WORDS: Record<string, number> = {
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
      (_, word: string) => String(NUMBER_WORDS[word.toLowerCase()]),
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
    const size = packs[2]!.trim();
    const unit = unitWord(packs[3] ?? '');
    const total = Number(packs[1]) * Number(size.replace(',', '.'));
    if (UNIT_WORDS.has(unit) && Number.isFinite(total)) {
      return {
        quantity: `${total} ${unit}`,
        name: withoutContainer(packs[4]!),
      };
    }
  }
  const lead = new RegExp(`^(${NUM})\\s*(.*)$`).exec(text);
  if (!lead || !lead[2]) {
    return undefined;
  }
  const amount = lead[1]!.trim();
  const words = lead[2].trim().split(/\s+/);
  if (words.length > 1 && UNIT_WORDS.has(unitWord(words[0]!))) {
    const rest = words.slice(1).join(' ');
    return {
      quantity: `${amount} ${unitWord(words[0]!)}`,
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
    words.length > 1 && CONTAINERS.has(unitWord(words[0]!))
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
    return { name: after[1]!.trim(), quantity: (after[2] ?? after[3])!.trim() };
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
const SYNONYMS: Record<string, string> = {
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
const IMPLIES: Record<string, string> = {
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
const IRREGULAR: Record<string, string> = {
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
  let w = IRREGULAR[word] ?? word;
  if (w.length > 3) {
    if (w.endsWith('ies') && w.length > 4) {
      w = `${w.slice(0, -3)}y`;
    } else if (/(?:ch|sh|x|z|ss|o)es$/.test(w)) {
      w = w.slice(0, -2);
    } else if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) {
      // "molasses", "hummus", "asparagus" are already singular
    } else if (w.endsWith('s')) {
      w = w.slice(0, -1);
    }
  }
  // chili / chilli / chilly and cookie / cooky all end the same way
  return w.length > 3 && /(?:ie|y)$/.test(w) ? w.replace(/(?:ie|y)$/, 'i') : w;
}

const MEATS = new Set(['beef', 'pork', 'lamb', 'chicken', 'turkey', 'mutton']);

/** The meaningful words of an ingredient name: singular, synonyms folded. */
export function ingredientWords(name: string): string[] {
  let words = foldText(name.replace(/\([^)]*\)/g, ' '))
    .split(/[^a-z]+/)
    .filter((w) => w && !DESCRIPTORS.has(w))
    .map((w) => stem(w))
    .map((w) => stem(SYNONYMS[w] ?? w));
  words = words.filter((w) => !DESCRIPTORS.has(w));
  const has = (w: string) => words.includes(w);
  // Spring and green onions are scallions, not onions.
  if (has('onion') && (has('spring') || has('green'))) {
    words = words.filter((w) => !['onion', 'spring', 'green'].includes(w));
    words.push('scallion');
  }
  // Coriander on its own is the herb, but "ground coriander" and the seeds are
  // the spice.
  if (has('coriander') && !['seed', 'ground', 'powder'].some(has)) {
    words = words.map((w) => (w === 'coriander' ? 'cilantro' : w));
  }
  // Mince is ground meat; on its own it stays "mince".
  if (has('mince') && words.some((w) => MEATS.has(w))) {
    words = words.map((w) => (w === 'mince' ? 'ground' : w));
  }
  for (const w of [...words]) {
    const implied = IMPLIES[w];
    if (implied) {
      words.push(implied);
    }
  }
  return [...new Set(words)];
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
function total(amounts: BaseAmount[]): BaseAmount | undefined {
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

/** Match one recipe's ingredients against the person's items. */
export function matchRecipe(
  ingredients: readonly RecipeIngredient[],
  pantry: readonly PantryItem[],
  options: { assumeStaples?: boolean } = {},
): PantryMatch {
  const assumeStaples = options.assumeStaples ?? true;
  const result: PantryMatch = { covered: [], missing: [], short: [], used: 0 };
  const usedItems = new Set<number>();

  // A recipe that lists tomatoes twice needs both amounts.
  const groups = new Map<string, RecipeIngredient[]>();
  for (const ingredient of ingredients) {
    const key =
      ingredientWords(ingredient.name).sort().join(' ') || ingredient.name;
    groups.set(key, [...(groups.get(key) ?? []), ingredient]);
  }

  for (const lines of groups.values()) {
    const first = lines[0]!;
    const matching = pantry
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => sameIngredient(item.name, first.name));
    if (matching.length === 0) {
      if (!(assumeStaples && isStaple(first.name))) {
        result.missing.push(first.name);
      }
      continue;
    }
    matching.forEach(({ index }) => usedItems.add(index));
    result.covered.push(first.name);

    // Add up what the person has of it across their items, when they said how
    // much, and compare that with everything the recipe wants of it.
    const needs = lines.map((l) => toBaseAmount(l.quantity));
    const need = needs.every(Boolean)
      ? total(needs as BaseAmount[])
      : undefined;
    const haves = matching
      .map(({ item }) => item)
      .filter((item) => item.quantity)
      .sort(
        (p, q) =>
          similarity(q.name, first.name) - similarity(p.name, first.name),
      );
    const amounts = haves.map((h) => toBaseAmount(h.quantity!));
    const usable = haves.filter(
      (_, i) => amounts[i] && need && comparable(amounts[i]!, need),
    );
    const have = total(usable.map((h) => toBaseAmount(h.quantity!)!));
    if (need && have && have.amount < need.amount * 0.99) {
      result.short.push({
        name: first.name,
        have: usable.map((h) => h.quantity!).join(' + '),
        need: lines.length === 1 ? first.quantity : describeAmount(need),
      });
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
