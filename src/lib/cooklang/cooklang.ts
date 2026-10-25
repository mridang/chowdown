/**
 * @packageDocumentation
 *
 * Cooklang parsing, isolated from React so it can be unit-tested without a
 * DOM. Wraps `@cooklang/cooklang-ts` and normalises its output into the
 * flat, presentation-ready shape the recipe view renders. Pure functions
 * only — no components, no side effects.
 */

import { Recipe } from '@cooklang/cooklang-ts';

import {
  leadingUnit,
  parseIngredientLine,
} from '@/lib/cooklang/ingredient-line';

/** A measured thing: an ingredient, a piece of cookware, or a timer. */
interface RawQuantity {
  readonly name?: string;
  readonly quantity?: string | number;
  readonly units?: string;
}

/** One token inside a step, as emitted by the parser. */
type RawStepItem =
  | { readonly type: 'text'; readonly value: string }
  | ({ readonly type: 'ingredient' } & RawQuantity)
  | ({ readonly type: 'cookware' } & RawQuantity)
  | ({ readonly type: 'timer' } & RawQuantity);

/** Structural view of a parsed `Recipe`, decoupled from the lib's types. */
interface RawRecipe {
  readonly metadata: Readonly<Record<string, string>>;
  readonly ingredients: readonly RawQuantity[];
  readonly cookwares: readonly RawQuantity[];
  readonly steps: readonly (readonly RawStepItem[])[];
}

/** An ingredient line for the ingredients panel. */
export interface ParsedIngredient {
  readonly name: string;
  readonly quantity: string;
}

/** A presentation-ready token within a method step. */
export type StepToken =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'ingredient';
      readonly name: string;
      readonly quantity: string;
    }
  | { readonly kind: 'cookware'; readonly name: string }
  | { readonly kind: 'timer'; readonly label: string };

/** A fully parsed recipe, ready to render. */
export interface ParsedRecipe {
  readonly title: string;
  readonly metadata: readonly (readonly [string, string])[];
  readonly ingredients: readonly ParsedIngredient[];
  readonly cookware: readonly string[];
  readonly steps: readonly (readonly StepToken[])[];
}

/** Format a quantity + units into a single label (`200 g`, `2`, ``). */
export function formatQuantity(item: Readonly<RawQuantity>): string {
  const { quantity, units } = item;
  const hasQuantity =
    quantity !== undefined &&
    quantity !== null &&
    quantity !== '' &&
    quantity !== 'some';
  const q = hasQuantity ? String(quantity) : '';
  if (q && units) {
    return `${q} ${units}`;
  }
  return q || units || '';
}

/** Turn a single parser step item into a render token. */
function toToken(item: Readonly<RawStepItem>): StepToken {
  switch (item.type) {
    case 'text':
      return { kind: 'text', text: item.value };
    case 'ingredient':
      return {
        kind: 'ingredient',
        name: item.name ?? '',
        quantity: formatQuantity(item),
      };
    case 'cookware':
      return { kind: 'cookware', name: item.name ?? '' };
    case 'timer':
      return {
        kind: 'timer',
        label: formatQuantity(item) || (item.name ?? ''),
      };
  }
}

/** An ingredient as the panel and the steps show it: a name and a quantity label. */
type Shown = { readonly name: string; readonly quantity: string };

/** What a quantity label reads as for a parsed line: `200 g`, `1/2`, `to taste`. */
function quantityLabel(parsed: ReturnType<typeof parseIngredientLine>): string {
  return [parsed.quantity, parsed.unit].filter(Boolean).join(' ');
}

/** Whether a stored name still has an amount, a bracket or stray punctuation in it. */
const UNTIDY_NAME =
  /^[^A-Za-z]|\(|^\d|,\s*[~\d]|\s,|,\s*(?:to taste|as needed|a )/;

/**
 * Put right an ingredient that was stored badly, which importers did before
 * `ingredient-line.ts` existed: the whole line in the name and nothing in the
 * quantity (`@Lamb stew meat, 1000 g{}`), an alternative measure left at the
 * front (`@/ 65 ml lime juice{1/4%cup}`), brackets and commas that belong to a
 * note (`@garlic cloves (, minced){2}`), or a unit left at the start of the name
 * (`@tsp of tomato paste{1}`). A name that is already tidy is returned as it is,
 * and a quantity that was stored is only replaced when the name carries a
 * fuller one with a unit. The files themselves are never rewritten.
 */
function repaired(item: Readonly<Shown>): Shown {
  if (!UNTIDY_NAME.test(item.name) && !leadingUnit(item.name)) {
    return item;
  }
  const parsed = parseIngredientLine(item.name.replace(/^[\s/\-•*]+/, ''));
  const hasUnit = /[A-Za-z]/.test(item.quantity);
  if (item.quantity === '') {
    return { name: parsed.name, quantity: quantityLabel(parsed) };
  }
  // A stored quantity with no unit next to a name that carries one: "1" and
  // "1/2 teaspoon red chilli powder" is "1/2 teaspoon", not "1".
  if (!hasUnit && parsed.unit) {
    return { name: parsed.name, quantity: quantityLabel(parsed) };
  }
  // "10-12" and "ounces portobello mushroom caps": the unit slipped into the name.
  const unit = leadingUnit(parsed.name);
  if (!hasUnit && unit && unit.rest !== '') {
    return { name: unit.rest, quantity: `${item.quantity} ${unit.unit}` };
  }
  return { name: parsed.name, quantity: item.quantity };
}

/**
 * A line that is nothing but one ingredient: `@name{amount}`, optionally with a
 * `(note)`, or a bare `@name`. The name may hold characters the Cooklang parser
 * would take for something else (`~` starts a timer, `#` cookware), which is
 * exactly why these lines are read here rather than by the parser.
 */
const INGREDIENT_LINE = /^@([^{}]+?)\s*(?:\{([^{}]*)\}(?:\([^()]*\))?)?\s*$/;

/** What an ingredient line's `{amount}` says: `200%g` is 200 g, `to taste` is itself, empty is nothing. */
function amountLabel(amount: string): string {
  const [quantity = '', unit = ''] = amount.split('%');
  return [quantity.trim(), unit.trim()].filter(Boolean).join(' ');
}

/** The ingredients a recipe declares up front, and the source without that block. */
interface Declaration {
  readonly declared: readonly Shown[];
  readonly rest: string;
}

/**
 * Take the ingredient declaration off the front of a recipe. Some importers
 * write the ingredients as a block of `@name{amount}` lines before the method;
 * the parser would read each line as a step, so the method would open with the
 * ingredients all over again. A leading run of two or more such lines (blank
 * lines between them are fine) with a method after it is that block: the lines
 * become the ingredients and the rest goes on to the parser. Anything else is
 * left exactly as it was.
 */
function splitDeclaration(source: string): Declaration {
  const lines = source.split(/\r?\n/);
  const firstBody = lines.findIndex(
    (line) => line.trim() !== '' && !line.startsWith('>>'),
  );
  if (firstBody < 0) {
    return { declared: [], rest: source };
  }
  const afterBlock = lines.findIndex(
    (line, index) =>
      index >= firstBody &&
      line.trim() !== '' &&
      !INGREDIENT_LINE.test(line.trim()),
  );
  const block = lines
    .slice(firstBody, afterBlock < 0 ? lines.length : afterBlock)
    .map((line) => INGREDIENT_LINE.exec(line.trim()))
    .flatMap((match) => (match ? [match] : []));
  // Needs a method to be separate from, and more than one line to be a block.
  if (afterBlock < 0 || block.length < 2) {
    return { declared: [], rest: source };
  }
  return {
    declared: block.map((match) =>
      repaired({
        name: (match[1] ?? '').trim(),
        quantity: amountLabel(match[2] ?? ''),
      }),
    ),
    rest: [...lines.slice(0, firstBody), ...lines.slice(afterBlock)].join('\n'),
  };
}

/**
 * Parse Cooklang source into a {@link ParsedRecipe}.
 *
 * A block of ingredient-only lines at the start is the recipe's ingredient
 * declaration (see {@link splitDeclaration}), not part of the method: it fills
 * the ingredients panel and is left out of `steps`, so the method starts with
 * the first thing to do and the ingredients are not listed twice. Ingredients that were stored badly are
 * repaired as they are read (see {@link repaired}).
 *
 * @param source - The raw `.cook` file contents.
 * @param filename - Used as the title when the recipe has no `>> title:`.
 */
export function parseRecipe(source: string, filename: string): ParsedRecipe {
  const { declared, rest } = splitDeclaration(source);
  // The @cooklang/cooklang-ts boundary: its Recipe has the same runtime shape
  // as RawRecipe but declares different types (Metadata, Step, Ingredient), so
  // this reads it through our own decoupled structural view.
  const raw = new Recipe(rest) as unknown as RawRecipe;
  const metadata = raw.metadata ?? {};
  const title = metadata['title'] || filename.replace(/\.cook$/i, '');

  const declaredNames = new Set(declared.map((i) => i.name.toLowerCase()));
  const inline = (raw.ingredients ?? [])
    .map((i) => repaired({ name: i.name ?? '', quantity: formatQuantity(i) }))
    // An ingredient the declaration already lists is not a new one when a step mentions it.
    .filter((i) => !declaredNames.has(i.name.toLowerCase()));

  return {
    title,
    metadata: Object.entries(metadata).filter(([key]) => key !== 'title'),
    ingredients: [...declared, ...inline],
    cookware: (raw.cookwares ?? []).map((c) => c.name ?? ''),
    steps: (raw.steps ?? []).map((step) =>
      step
        .map(toToken)
        .map((token) =>
          token.kind === 'ingredient'
            ? { ...token, ...repaired(token) }
            : token,
        ),
    ),
  };
}
