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
const VULGAR: Readonly<Record<string, string>> = {
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
};

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
  /^\s+(heaping|heaped|level|rounded|scant|generous)(?=\s)/i;

/** Phrases that stand in for a quantity when there is no number. */
const FREE_QUANTITY =
  /^(?:to taste|as needed|as required|a pinch|pinch|a dash|dash|a handful|handful|a few|few|some|a little|for serving|for garnish|optional)$/i;

/**
 * What starts a preparation note after a comma ("onion, finely chopped"), as
 * opposed to a comma inside a name ("boneless, skinless chicken breasts").
 */
const PREPARATION =
  /^(?:(?:very |finely |roughly |thinly |coarsely |freshly |lightly |well )?(?:chopped|diced|minced|sliced|grated|crushed|peeled|halved|quartered|cubed|melted|softened|divided|cooked|drained|rinsed|beaten|trimmed|seeded|deseeded|stemmed|torn|packed|sifted|toasted|shredded|julienned|mashed|thawed|cut|ground)|optional|plus |to taste|for |at room|room temp|or |about |such as|preferably|if )/i;

/** A number: `3`, `2.5`, `1/2`, or a mixed number `1 1/2`. */
const NUMBER = String.raw`\d+/\d+|\d+(?:[.,]\d+)?(?:\s\d+/\d+)?`;

/** A number or a range of two (`8-12`, `2 to 3`). */
const QUANTITY = new RegExp(
  String.raw`^(?:about |approx\.? |approximately |around |~\s?)?((?:${NUMBER})(?:\s?(?:-|to)\s?(?:${NUMBER}))?)`,
  'i',
);

/** Spell vulgar fractions out, joined to a whole number with a space (`1½` becomes `1 1/2`). */
function withAsciiFractions(text: string): string {
  return text.replace(/(\d)?([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/g, (_, whole, fraction) => {
    const ascii = VULGAR[fraction as string] ?? '';
    return whole ? `${whole as string} ${ascii}` : ascii;
  });
}

/** The character references that turn up in text copied from web pages. */
const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&#39;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
};

/** Tidy characters that only make parsing harder: dashes, spaces, bullets, a leading "of". */
function tidied(raw: string): string {
  return withAsciiFractions(
    raw
      .slice(0, MAX_LINE)
      .replace(
        /&(?:amp|apos|quot|nbsp|lt|gt|#39);/g,
        (entity) => ENTITIES[entity] ?? entity,
      )
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .replace(/^[-•*·\s]+/, '')
    .trim();
}

/** The state of the walk that pulls parenthesised text out of a line. */
interface ParenthesesWalk {
  readonly text: string;
  readonly notes: readonly string[];
  readonly depth: number;
  readonly buffer: string;
}

/**
 * Take every parenthesised phrase out of `line`, returning what is left and the
 * phrases (outermost ones, nesting kept inside them). An unmatched `(` swallows
 * the rest of the line as a note rather than leaving a stray bracket in a name.
 */
function withoutParentheses(line: string): {
  readonly text: string;
  readonly notes: readonly string[];
} {
  const walked = [...line].reduce<ParenthesesWalk>(
    (walk, char) => {
      if (char === '(') {
        return walk.depth === 0
          ? { ...walk, depth: 1, text: `${walk.text} ` }
          : { ...walk, depth: walk.depth + 1, buffer: `${walk.buffer}(` };
      }
      if (char === ')' && walk.depth > 0) {
        return walk.depth === 1
          ? {
              ...walk,
              depth: 0,
              notes: [...walk.notes, walk.buffer],
              buffer: '',
            }
          : { ...walk, depth: walk.depth - 1, buffer: `${walk.buffer})` };
      }
      return walk.depth > 0
        ? { ...walk, buffer: `${walk.buffer}${char}` }
        : { ...walk, text: `${walk.text}${char}` };
    },
    { text: '', notes: [], depth: 0, buffer: '' },
  );
  const notes =
    walked.depth > 0 ? [...walked.notes, walked.buffer] : walked.notes;
  return {
    text: walked.text.replace(/\s+/g, ' ').trim(),
    notes: notes
      .map((note) => note.replace(/^[\s,;:]+|[\s,;:]+$/g, '').trim())
      .filter((note) => note !== ''),
  };
}

/** Spellings that are really another unit, so a list reads the same however each line was typed. */
const UNIT_SPELLINGS: Readonly<Record<string, string>> = {
  tspn: 'tsp',
  tbs: 'tbsp',
  tbl: 'tbsp',
  gr: 'g',
};

/** A unit word without a trailing full stop (`oz.`), lower-cased and in its usual spelling. */
function unitKey(word: string): string {
  const bare = word.replace(/\.$/, '').toLowerCase();
  return UNIT_SPELLINGS[bare] ?? bare;
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
  if (!match || /^0\d/.test(match[1] ?? '')) {
    return undefined;
  }
  const quantity = (match[1] ?? '')
    .replace(/\s+to\s+/i, '-')
    .replace(/\s*-\s*/g, '-')
    .trim();
  const afterQuantity = text.slice(match[0].length);
  const described = MEASURE_ADJECTIVES.exec(afterQuantity);
  const afterNumber = described
    ? afterQuantity.slice(described[0].length)
    : afterQuantity;
  // A unit may be glued to the number (`100g`) or hyphenated to it (`1-inch`).
  const attached = /^-?([A-Za-z]+)\.?(?=$|[\s,/])/.exec(afterNumber);
  const attachedUnit = attached?.[1];
  const spaced = /^\s+([A-Za-z]+)\.?(?=$|[\s,/])/.exec(afterNumber);
  const spacedUnit = spaced?.[1];
  const [unit, consumed] =
    attachedUnit && UNITS.has(unitKey(attachedUnit))
      ? [attachedUnit, attached?.[0].length ?? 0]
      : spacedUnit && UNITS.has(unitKey(spacedUnit))
        ? [spacedUnit, spaced?.[0].length ?? 0]
        : [undefined, 0];
  const rest = afterNumber.slice(consumed);
  // "7up" and "2x4" are names with a digit in them, not an amount and a word.
  if (!unit && /^[A-Za-z]/.test(afterNumber)) {
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
  return /^an? [^,]{1,16}$/i.test(text)
    ? { quantity: text, rest: '' }
    : undefined;
}

/** Strip punctuation that is left dangling after parts of the line were taken out. */
function cleanedName(text: string): string {
  return text
    .replace(/^(?:of|x)\s+/i, '')
    .replace(/^[\s,;:./-]+|[\s,;:./-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Join the notes into one, without repeats. */
function joinedNotes(notes: readonly string[]): string | undefined {
  const unique = [...new Set(notes.filter((note) => note !== ''))];
  return unique.length > 0 ? unique.join('; ') : undefined;
}

/**
 * Split `name, rest` into the name and a preparation note, when `rest` reads
 * like one ("diced", "finely chopped", "to taste"). A comma inside a name
 * ("boneless, skinless chicken breasts") is left alone.
 */
function splitPreparation(text: string): {
  readonly name: string;
  readonly note?: string;
} {
  // A comma with a space before it is how a note is set apart: "mozzarella , chilled".
  const spaced = text.search(/\s,/);
  if (spaced > 0) {
    return { name: text.slice(0, spaced), note: text.slice(spaced + 1).trim() };
  }
  const comma = text.search(/,\s/);
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
  /^(a pinch|a dash|a handful|a few|a bit|a little|a splash|a drizzle|a knob|a sprinkle)(?: of)?\s+(\S.*)$/i;

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
  const match =
    /^(?:(?:heaping|heaped|level|rounded|scant|generous)\s+)?([A-Za-z]+)\.?(?:\s+of)?(?:\s+|$)/i.exec(
      text.trim(),
    );
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
      .replace(/[{}@#~()%]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const amount =
    ing.quantity && ing.unit
      ? `${safe(ing.quantity)}%${safe(ing.unit)}`
      : safe(ing.quantity ?? '');
  const note = ing.note ? safe(ing.note) : '';
  return `@${safe(ing.name)}{${amount}}${note ? `(${note})` : ''}`;
}
