/**
 * @packageDocumentation
 *
 * Cooklang parsing, isolated from React so it can be unit-tested without a
 * DOM. Wraps `@cooklang/cooklang-ts` and normalises its output into the
 * flat, presentation-ready shape the recipe view renders. Pure functions
 * only — no components, no side effects.
 */

import { Recipe } from '@cooklang/cooklang-ts';

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

/**
 * Parse Cooklang source into a {@link ParsedRecipe}.
 *
 * @param source - The raw `.cook` file contents.
 * @param filename - Used as the title when the recipe has no `>> title:`.
 */
export function parseRecipe(source: string, filename: string): ParsedRecipe {
  const raw = new Recipe(source) as unknown as RawRecipe;
  const metadata = raw.metadata ?? {};
  const title = metadata['title'] || filename.replace(/\.cook$/i, '');

  return {
    title,
    metadata: Object.entries(metadata).filter(([key]) => key !== 'title'),
    ingredients: (raw.ingredients ?? []).map((i) => ({
      name: i.name ?? '',
      quantity: formatQuantity(i),
    })),
    cookware: (raw.cookwares ?? []).map((c) => c.name ?? ''),
    steps: (raw.steps ?? []).map((step) => step.map(toToken)),
  };
}
