/**
 * @packageDocumentation
 *
 * Reading the "what I have" argument of `recipes_from_ingredients`. Models send
 * it in every shape: a list of strings, one string holding a whole sentence
 * ("3 tomatoes and 400 g pasta"), or objects with a name and a quantity. This
 * module turns all of them into a list of pantry items, and caps how much it
 * will read so a huge request cannot hog the server.
 */

import {
  isUnitWord,
  parsePantryItem,
  type PantryItem,
} from '@/domain/recipe/pantry-match';

const AND = /\sand\s/i;
const START_DIGITS_PLUS_SPACE_STAR = /^\d+\s*[x×]/;
const ESC_OR_END = /\W|^$/;
const START_DIGITS_ANY_COMMA_SLASH = /^[\d½¼¾⅓⅔.,/]+$/;
const WHITESPACE_RUN = /\s+/;

/** The most pantry items a request may carry. */
const MAX_PANTRY_ITEMS = 60;

/** The longest single item, in characters. */
const MAX_ITEM_LENGTH = 80;

/** The longest quantity given as a separate field, in characters. */
const MAX_QUANTITY_LENGTH = 40;

/** Stands in for the "and" of a phrase that names one thing while splitting. */
const JOINED = '\u0000';

/** Phrases with an "and" in them that name one thing. */
const ONE_THING =
  /\b(mac and cheese|salt and pepper|bread and butter|pork and beans|fish and chips|rice and peas|half and half)\b/gi;

/** A comma or semicolon that ends an item (not one inside a number like "1,5"), or an ampersand. */
const SEPARATOR = /^(?:[,;](?=\s|$)|&)/;

/** The word "and" at the start of the text. */
const AND_WORD = /^\band\b/i;

/** A bare amount ("3", "400 g"): not an item, but the amount of the one before. */
function isBareAmount(text: string): boolean {
  const [amount, unit, ...rest] = text.trim().split(WHITESPACE_RUN);
  return (
    START_DIGITS_ANY_COMMA_SLASH.test(amount ?? '') &&
    rest.length === 0 &&
    (unit === undefined || isUnitWord(unit))
  );
}

/** Where the scan of the text has got to. */
interface Scan {
  /** How many brackets are open. Nothing splits inside them. */
  readonly depth: number;
  /** The item being read. */
  readonly current: string;
  /** The items finished so far. */
  readonly parts: readonly string[];
  /** How many more characters to skip (the rest of an "and"). */
  readonly skip: number;
}

/** Take one more character of `text` (at `index`) into the scan. */
function scanStep(text: string, scan: Scan, index: number): Scan {
  if (scan.skip > 0) {
    return { ...scan, skip: scan.skip - 1 };
  }
  const ch = text.charAt(index);
  let depth = scan.depth;
  if (ch === '(') {
    depth += 1;
  }
  if (ch === ')') {
    depth = Math.max(0, depth - 1);
  }
  const rest = text.slice(index);
  if (depth === 0 && SEPARATOR.test(rest)) {
    return {
      ...scan,
      depth,
      parts: [...scan.parts, scan.current],
      current: '',
    };
  }
  // An "and" on its own (not the end of "brand" or the start of "android").
  if (
    depth === 0 &&
    AND_WORD.test(rest) &&
    ESC_OR_END.test(text.charAt(index - 1) || ' ')
  ) {
    return {
      ...scan,
      depth,
      parts: [...scan.parts, scan.current],
      current: '',
      skip: 2,
    };
  }
  return { ...scan, depth, current: scan.current + ch };
}

/**
 * Split "3 tomatoes and 400 g pasta, onions" into items. Commas inside
 * brackets and inside numbers ("1,5 kg", "1,000 g") don't split, and a bare
 * amount after a comma ("Tomatoes, 3") goes back to the item before it.
 */
function splitItems(text: string): readonly string[] {
  const start: Scan = { depth: 0, current: '', parts: [], skip: 0 };
  const scanned = Array.from(
    { length: text.length },
    (_, index) => index,
  ).reduce((scan, index) => scanStep(text, scan, index), start);
  return [...scanned.parts, scanned.current]
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce<string[]>((items, raw) => {
      const previous = items.at(-1);
      if (
        previous !== undefined &&
        isBareAmount(raw) &&
        !START_DIGITS_PLUS_SPACE_STAR.test(raw)
      ) {
        items[items.length - 1] = `${previous}, ${raw}`;
      } else {
        items.push(raw);
      }
      return items;
    }, []);
}

/** The pantry items in one string, which may name several ("3 tomatoes and 400 g pasta"). */
function itemsFromText(entry: string): readonly PantryItem[] {
  const text = entry
    .slice(0, MAX_ITEM_LENGTH * 4)
    .replaceAll(ONE_THING, (m) => m.replace(AND, JOINED));
  return splitItems(text).map((part) =>
    parsePantryItem(part.replaceAll(JOINED, ' and ').slice(0, MAX_ITEM_LENGTH)),
  );
}

/** The pantry item an object stands for (`{ name, quantity? }`), if it names one. */
function itemFromObject(entry: object): readonly PantryItem[] {
  const name: unknown = Reflect.get(entry, 'name');
  const quantity: unknown = Reflect.get(entry, 'quantity');
  if (typeof name !== 'string' || !name.trim()) {
    return [];
  }
  const clean = name.trim().slice(0, MAX_ITEM_LENGTH);
  return [
    typeof quantity === 'string' || typeof quantity === 'number'
      ? {
          name: clean,
          quantity: String(quantity).trim().slice(0, MAX_QUANTITY_LENGTH),
        }
      : { name: clean },
  ];
}

/** The pantry items asked for: strings like "3 tomatoes", or {name, quantity}. */
export function pantryOf(value: unknown): readonly PantryItem[] {
  const asList: readonly unknown[] = Array.isArray(value) ? value : [value];
  const list = (value === undefined ? [] : asList).slice(0, MAX_PANTRY_ITEMS);
  return list
    .flatMap((entry: unknown): readonly PantryItem[] => {
      if (typeof entry === 'string') {
        return itemsFromText(entry);
      }
      return typeof entry === 'object' && entry !== null
        ? itemFromObject(entry)
        : [];
    })
    .filter((item) => item.name)
    .slice(0, MAX_PANTRY_ITEMS);
}
