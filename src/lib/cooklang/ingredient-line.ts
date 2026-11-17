const START_COLON_HEAPING_OR_HEAPED =
  /^(?:(?:heaping|heaped|level|rounded|scant|generous)\s+)?([a-z]+)\.?(?:\s+of)?(?:\s+|$)/iu;
const COMMA_SPACE = /,\s/u;
const SPACE_COMMA = /\s,/u;
const SPACE_COMMA_SEMICOLON_COLON_ANY = /[\s,;:./-]/u;
const START_COLON_OF_OR_X = /^(?:of|x)\s+/iu;
const WHITESPACE = /\s/u;
const AN = /^an? [^,]{1,16}$/iu;
const ZA = /^[A-Za-z]/u;
const ZA_2 = /^\s+([A-Za-z]+)\.?(?=$|[\s,/])/u;
const ZA_3 = /^-?([A-Za-z]+)\.?(?=$|[\s,/])/u;
const START_N0_DIGITS = /^0\d/u;
const TRAILING_DOT = /\.$/u;
const SPACE_COMMA_SEMICOLON_COLON = /[\s,;:]/u;
const START_HYPHEN_STAR_SPACE_PLUS = /^[-•*·\s]+/u;
/**
 * @packageDocumentation
 *
 * Reading one ingredient as people write it ("2 garlic cloves, minced",
 * "100g pancetta", "1/4 cup / 65 ml lime juice", "Lamb stew meat, 1000 g") and
 * turning it into the three parts Cooklang keeps apart: a quantity, a unit and
 * a name. Recipe sites and notes apps each have their own habits, and an
 * import that gets them wrong shows as an ingredients list full of numbers in
 * the names and nothing in the quantity column, so the reading is deliberately
 * forgiving, and the same reading repairs ingredients that were stored badly
 * before it existed (see `cooklang.ts`).
 *
 * Everything here is a pure function over one short line. Lines are cut to
 * {@link MAX_LINE} characters first and every pattern is anchored and has no
 * nested repetition, so no input can make the reading slow.
 */

/** A parsed ingredient. The quantity is text because it may be "1 1/2", "8-12" or "to taste". */
export interface ParsedIngredientLine {
  readonly quantity?: string;
  readonly unit?: string;
  readonly name: string;
  /** What the line said about preparation or alternatives ("minced", "10.5 oz"), if anything. */
  readonly note?: string;
}

/** The longest line read; anything longer is a paragraph, not an ingredient. */
const MAX_LINE = 300;

/** The vulgar fractions (and their ASCII spelling) that appear in recipes. */
const VULGAR = new Map<string, string>(
  Object.entries({
    '½': '1/2',
    '¼': '1/4',
    '¾': '3/4',
    '⅓': '1/3',
    '⅔': '2/3',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
    '⅕': '1/5',
    '⅖': '2/5',
    '⅗': '3/5',
    '⅘': '4/5',
  }),
);

/** Words that measure something, as the word right after a quantity. */
const UNITS: ReadonlySet<string> = new Set([
  'g',
  'gram',
  'grams',
  'gr',
  'kg',
  'kilo',
  'kilos',
  'kilogram',
  'kilograms',
  'mg',
  'ml',
  'millilitre',
  'millilitres',
  'milliliter',
  'milliliters',
  'cl',
  'dl',
  'l',
  'litre',
  'litres',
  'liter',
  'liters',
  'cup',
  'cups',
  'tbsp',
  'tbs',
  'tbl',
  'tablespoon',
  'tablespoons',
  'tsp',
  'tspn',
  'teaspoon',
  'teaspoons',
  'spoon',
  'spoons',
  'spoonful',
  'spoonfuls',
  'pint',
  'pints',
  'quart',
  'quarts',
  'gallon',
  'gallons',
  'oz',
  'ounce',
  'ounces',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'pinch',
  'pinches',
  'dash',
  'dashes',
  'clove',
  'cloves',
  'slice',
  'slices',
  'can',
  'cans',
  'tin',
  'tins',
  'jar',
  'jars',
  'packet',
  'packets',
  'package',
  'packages',
  'pkg',
  'stick',
  'sticks',
  'piece',
  'pieces',
  'bunch',
  'bunches',
  'sprig',
  'sprigs',
  'head',
  'heads',
  'handful',
  'handfuls',
  'inch',
  'inches',
  'cm',
  'sheet',
  'sheets',
  'stalk',
  'stalks',
  'knob',
  'knobs',
]);

/** Words that describe how a measure is filled, between the number and the unit ("1 heaping tsp"). */
const MEASURE_ADJECTIVES =
  /^\s+(heaping|heaped|level|rounded|scant|generous)(?=\s)/iu;

/** Phrases that stand in for a quantity when there is no number. */
const FREE_QUANTITY =
  /^(?:to taste|as needed|as required|a pinch|pinch|a dash|dash|a handful|handful|a few|few|some|a little|for serving|for garnish|optional)$/iu;

/** How a preparation word may be softened: "finely chopped". */
const PREPARATION_ADVERBS =
  '(?:very |finely |roughly |thinly |coarsely |freshly |lightly |well )';

/** What is done to an ingredient: "chopped", "peeled". */
const PREPARATION_VERBS = [
  'chopped|diced|minced|sliced|grated|crushed|peeled|halved|quartered|cubed',
  'melted|softened|divided|cooked|drained|rinsed|beaten|trimmed|seeded',
  'deseeded|stemmed|torn|packed|sifted|toasted|shredded|julienned|mashed',
  'thawed|cut|ground',
].join('|');

/** Other phrases that open a note: "optional", "plus 1 tbsp", "to taste". */
const PREPARATION_LEADS =
  'optional|plus |to taste|for |at room|room temp|or |about |such as|preferably|if ';

/**
 * What starts a preparation note after a comma ("onion, finely chopped"), as
 * opposed to a comma inside a name ("boneless, skinless chicken breasts").
 */
export const PREPARATION = new RegExp(
  `^(?:${PREPARATION_ADVERBS}?(?:${PREPARATION_VERBS})|${PREPARATION_LEADS})`,
  'iu',
);

/** A number: `3`, `2.5`, `1/2`, or a mixed number `1 1/2`. */
const NUMBER = String.raw`\d+/\d+|\d+(?:[.,]\d+)?(?:\s\d+/\d+)?`;

/** A number or a range of two (`8-12`, `2 to 3`). */
const QUANTITY = new RegExp(
  String.raw`^(?:about |approx\.? |approximately |around |~\s?)?((?:${NUMBER})(?:\s?(?:-|to)\s?(?:${NUMBER}))?)`,
  'iu',
);

/** Spell vulgar fractions out, joined to a whole number with a space (`1½` becomes `1 1/2`). */
function withAsciiFractions(text: string): string {
  return text.replaceAll(/(\d)?([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/gu, (_, whole, fraction) => {
    const ascii = VULGAR.get(fraction as string) ?? '';
    return whole ? `${whole as string} ${ascii}` : ascii;
  });
}

/** The character references that turn up in text copied from web pages. */
const ENTITIES = new Map<string, string>(
  Object.entries({
    '&amp;': '&',
    '&#39;': "'",
    '&apos;': "'",
    '&quot;': '"',
    '&nbsp;': ' ',
    '&lt;': '<',
    '&gt;': '>',
  }),
);

/** Tidy characters that only make parsing harder: dashes, spaces, bullets, a leading "of". */
function tidied(raw: string): string {
  return withAsciiFractions(
    raw
      .slice(0, MAX_LINE)
      .replaceAll(
        /&(?:amp|apos|quot|nbsp|lt|gt|#39);/gu,
        (entity) => ENTITIES.get(entity) ?? entity,
      )
      .replaceAll(/[–—−]/gu, '-')
      .replaceAll(/\s+/gu, ' ')
      .trim(),
  )
    .replace(START_HYPHEN_STAR_SPACE_PLUS, '')
    .trim();
}

/** The state of the walk that pulls parenthesised text out of a line. */
interface ParenthesesWalk {
  readonly notes: readonly string[];
  readonly depth: number;
  readonly buffer: string;
  readonly text: string;
}

/** A line's text with its parenthesised phrases taken out, and those phrases. */
interface TextAndNotes {
  readonly text: string;
  readonly notes: readonly string[];
}

/**
 * Take every parenthesised phrase out of `line`, returning what is left and the
 * phrases (outermost ones, nesting kept inside them). An unmatched `(` swallows
 * the rest of the line as a note rather than leaving a stray bracket in a name.
 */
function withoutParentheses(line: string): TextAndNotes {
  const walked = Array.from(line).reduce<ParenthesesWalk>(
    (state, char) => {
      if (char === '(') {
        return state.depth === 0
          ? { ...state, depth: 1, text: `${state.text} ` }
          : { ...state, depth: state.depth + 1, buffer: `${state.buffer}(` };
      }
      if (char === ')' && state.depth > 0) {
        return state.depth === 1
          ? {
              ...state,
              notes: [...state.notes, state.buffer],
              depth: 0,
              buffer: '',
            }
          : { ...state, depth: state.depth - 1, buffer: `${state.buffer})` };
      }
      return state.depth > 0
        ? { ...state, buffer: `${state.buffer}${char}` }
        : { ...state, text: `${state.text}${char}` };
    },
    { text: '', notes: [], depth: 0, buffer: '' },
  );
  const notes =
    walked.depth > 0 ? [...walked.notes, walked.buffer] : walked.notes;
  return {
    text: walked.text.replaceAll(/\s+/gu, ' ').trim(),
    notes: notes
      .map((note) =>
        trimEdges(
          note,
          SPACE_COMMA_SEMICOLON_COLON,
          SPACE_COMMA_SEMICOLON_COLON,
        ).trim(),
      )
      .filter((note) => note !== ''),
  };
}

/** Spellings that are really another unit, so a list reads the same however each line was typed. */
const UNIT_SPELLINGS = new Map<string, string>(
  Object.entries({
    tspn: 'tsp',
    tbs: 'tbsp',
    tbl: 'tbsp',
    gr: 'g',
  }),
);

/** A unit word without a trailing full stop (`oz.`), lower-cased and in its usual spelling. */
function unitKey(word: string): string {
  const bare = word.replace(TRAILING_DOT, '').toLowerCase();
  return UNIT_SPELLINGS.get(bare) ?? bare;
}

/** A quantity read off the front of some text. */
interface LeadingQuantity {
  readonly quantity: string;
  readonly unit?: string;
  readonly rest: string;
}

/**
 * Read a quantity, and a unit if one follows, off the front of `text`:
 * `100g pancetta`, `1 1/2 cups flour`, `8-12 tortillas`, `1-inch piece of ginger`.
 * An alternative measure after a slash (`1/4 cup / 65 ml`) is read past and left
 * out. Returns undefined when `text` does not start with a number.
 */
function leadingQuantity(text: string): LeadingQuantity | undefined {
  const match = QUANTITY.exec(text);
  // "00 flour" and "0000 flour" are grades of flour, not amounts.
  if (!match || START_N0_DIGITS.test(match[1] ?? '')) {
    return undefined;
  }
  const quantity = tightHyphens(withHyphenForTo(match[1] ?? '')).trim();
  const afterQuantity = text.slice(match[0].length);
  const described = MEASURE_ADJECTIVES.exec(afterQuantity);
  const afterNumber = described
    ? afterQuantity.slice(described[0].length)
    : afterQuantity;
  // A unit may be glued to the number (`100g`) or hyphenated to it (`1-inch`).
  const attached = ZA_3.exec(afterNumber);
  const spaced = ZA_2.exec(afterNumber);
  // No unit following the number means nothing is consumed.
  const picked = [attached, spaced].find(
    (found) => found?.[1] && UNITS.has(unitKey(found[1])),
  );
  const unit = picked?.[1];
  const rest = afterNumber.slice(picked?.[0].length ?? 0);
  // "7up" and "2x4" are names with a digit in them, not an amount and a word.
  if (!unit && ZA.test(afterNumber)) {
    return undefined;
  }
  return {
    quantity,
    ...(unit ? { unit: unitKey(unit) } : {}),
    rest: withoutAlternativeMeasure(rest),
  };
}

/** Drop a leading `/ 65 ml` or `/ 1.2 lb`: the same amount in another system. */
function withoutAlternativeMeasure(text: string): string {
  const match = new RegExp(
    String.raw`^\s*/\s*(?:${NUMBER})(?:-(?:${NUMBER}))?\s*[A-Za-z]*\.?(?=$|[\s,])`,
    'u',
  ).exec(text);
  return match ? text.slice(match[0].length) : text;
}

/**
 * Whether `phrase` is the amount in a "Name, amount" ingredient: a number with
 * an optional unit and a word or two (`1000 g`, `2 cloves`, `1/2 spoonful`,
 * `a 1" piece`), or one of the stock phrases (`to taste`).
 */
function amountPhrase(phrase: string): LeadingQuantity | undefined {
  const text = phrase.trim();
  if (FREE_QUANTITY.test(text)) {
    return { quantity: text.toLowerCase(), rest: '' };
  }
  const read = leadingQuantity(text);
  if (read) {
    const leftover = read.rest.trim();
    if (leftover === '') {
      return read;
    }
    // "1 small stick": a number then a few words; keep all of it as the amount.
    return leftover.split(' ').length <= 3
      ? { quantity: text, rest: '' }
      : undefined;
  }
  return AN.test(text) ? { quantity: text, rest: '' } : undefined;
}

/** `text` without the leading characters `leading` accepts and the trailing ones `trailing` accepts. */
function trimEdges(text: string, leading: RegExp, trailing: RegExp): string {
  const chars = Array.from(text);
  const start = chars.findIndex((char) => !leading.test(char));
  const end = chars.findLastIndex(
    (char, index) => index >= start && !trailing.test(char),
  );
  return start === -1 || end === -1 ? '' : chars.slice(start, end + 1).join('');
}

/** `text` with its first whitespace-padded `to` ("1 to 2") turned into a hyphen. */
function withHyphenForTo(text: string): string {
  const found = Array.from(text.matchAll(/to/giu)).find(
    (match) =>
      WHITESPACE.test(text.charAt(match.index - 1)) &&
      WHITESPACE.test(text.charAt(match.index + 2)),
  );
  return found
    ? `${text.slice(0, found.index).trimEnd()}-${text.slice(found.index + 2).trimStart()}`
    : text;
}

/** `text` with the whitespace around every hyphen removed. */
function tightHyphens(text: string): string {
  const parts = text.split('-');
  const last = parts.length - 1;
  return parts
    .map((part, index) => {
      const left = index > 0 ? part.trimStart() : part;
      return index < last ? left.trimEnd() : left;
    })
    .join('-');
}

/** Strip punctuation that is left dangling after parts of the line were taken out. */
function cleanedName(text: string): string {
  return trimEdges(
    text.replace(START_COLON_OF_OR_X, ''),
    SPACE_COMMA_SEMICOLON_COLON_ANY,
    SPACE_COMMA_SEMICOLON_COLON_ANY,
  )
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

/** Join the notes into one, without repeats. */
function joinedNotes(notes: readonly string[]): string | undefined {
  const unique = [...new Set(notes.filter((note) => note !== ''))];
  return unique.length > 0 ? unique.join('; ') : undefined;
}

/** An ingredient's name and, when it has one, its preparation note. */
interface NameAndNote {
  readonly name: string;
  readonly note?: string;
}

/**
 * Split `name, rest` into the name and a preparation note, when `rest` reads
 * like one ("diced", "finely chopped", "to taste"). A comma inside a name
 * ("boneless, skinless chicken breasts") is left alone.
 */
function splitPreparation(text: string): NameAndNote {
  // A comma with a space before it is how a note is set apart: "mozzarella , chilled".
  const spaced = text.search(SPACE_COMMA);
  if (spaced > 0) {
    return { name: text.slice(0, spaced), note: text.slice(spaced + 1).trim() };
  }
  const comma = text.search(COMMA_SPACE);
  if (comma > 0) {
    const tail = text.slice(comma + 1).trim();
    if (PREPARATION.test(tail)) {
      return { name: text.slice(0, comma), note: tail };
    }
  }
  return { name: text };
}

/** A loose amount at the start of a line: "a pinch of saffron", "a handful of mint". */
const LOOSE_AMOUNT =
  /^(a pinch|a dash|a handful|a few|a bit|a little|a splash|a drizzle|a knob|a sprinkle)(?: of)?\s+(\S.*)$/iu;

/**
 * Parse one ingredient line into a quantity, unit, name and note.
 *
 * The quantity may come first (`2 garlic cloves, minced`, `100g pancetta`,
 * `1/4 cup / 65 ml lime juice`, `½ tbsp ginger`) or last (`Garlic, 2 cloves`,
 * `Lamb stew meat, 1000 g`, `Salt, to taste`); a quantity in brackets at the
 * front (`(2 tbsp) ghee`) counts when there is none outside them. Anything
 * else in brackets, and preparation after a comma, becomes the note. A line with
 * no quantity at all keeps everything as its name ("fresh basil").
 */
export function parseIngredientLine(raw: string): ParsedIngredientLine {
  const original = tidied(raw);
  const loose = LOOSE_AMOUNT.exec(original);
  if (loose) {
    const rest = parseIngredientLine(loose[2] ?? '');
    return {
      ...rest,
      quantity: rest.quantity ?? (loose[1] ?? '').toLowerCase(),
    };
  }
  const { text, notes } = withoutParentheses(original);
  const front = leadingQuantity(text);
  // A measure in brackets stands in for a missing quantity: "(2 tbsp) ghee".
  const bracketed =
    front === undefined
      ? notes
          .map((note) => ({ note, read: amountPhrase(note) }))
          .find(
            ({ note, read }) => read !== undefined && !FREE_QUANTITY.test(note),
          )
      : undefined;
  const remainingNotes = bracketed
    ? notes.filter((note) => note !== bracketed.note)
    : notes;

  if (front) {
    const prepared = splitPreparation(front.rest.trim());
    const name = cleanedName(prepared.name);
    return {
      quantity: front.quantity,
      ...(front.unit ? { unit: front.unit } : {}),
      name: name || cleanedName(text) || original,
      ...withNote(joinedNotes([...remainingNotes, prepared.note ?? ''])),
    };
  }

  // Quantity last: "Name, amount".
  const lastComma = text.lastIndexOf(',');
  if (lastComma > 0) {
    const amount = amountPhrase(text.slice(lastComma + 1));
    if (amount) {
      return {
        quantity: amount.quantity,
        ...(amount.unit ? { unit: amount.unit } : {}),
        name: cleanedName(text.slice(0, lastComma)) || original,
        ...withNote(joinedNotes(remainingNotes)),
      };
    }
  }

  const prepared = splitPreparation(text);
  const name = cleanedName(prepared.name);
  const read = bracketed?.read;
  return {
    ...(read
      ? { quantity: read.quantity, ...(read.unit ? { unit: read.unit } : {}) }
      : {}),
    name: name || original,
    ...withNote(
      joinedNotes([
        ...remainingNotes.filter((note) => note !== bracketed?.note),
        prepared.note ?? '',
      ]),
    ),
  };
}

/**
 * A unit word at the very start of `text`, and what follows it: "tsp of tomato
 * paste" gives unit `tsp` and "tomato paste"; "heaping tsp of salt" too.
 * Undefined when `text` does not start with one. Used to repair an ingredient
 * whose number was split from its unit.
 */
export function leadingUnit(
  text: string,
): { readonly unit: string; readonly rest: string } | undefined {
  const match = START_COLON_HEAPING_OR_HEAPED.exec(text.trim());
  const word = match?.[1];
  return match && word && UNITS.has(unitKey(word))
    ? { unit: unitKey(word), rest: text.trim().slice(match[0].length).trim() }
    : undefined;
}

/** `{ note }` when there is one, so the property is absent rather than `undefined`. */
function withNote(note: string | undefined): { readonly note?: string } {
  return note ? { note } : {};
}

/**
 * Render a parsed ingredient as a Cooklang token: `@name{qty%unit}`, followed by
 * `(note)` when it has one. Characters that mean something in Cooklang are
 * taken out of the name and note, so a line from the web can never end or
 * start a token early.
 */
export function toCookIngredient(ing: Readonly<ParsedIngredientLine>): string {
  const safe = (text: string): string =>
    text
      .replaceAll(/[{}@#~()%]/gu, ' ')
      .replaceAll(/\s+/gu, ' ')
      .trim();
  const amount =
    ing.quantity && ing.unit
      ? `${safe(ing.quantity)}%${safe(ing.unit)}`
      : safe(ing.quantity ?? '');
  const note = ing.note ? safe(ing.note) : '';
  const notePart = note ? `(${note})` : '';
  return `@${safe(ing.name)}{${amount}}${notePart}`;
}
