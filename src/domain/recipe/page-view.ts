/**
 * @packageDocumentation
 *
 * Small pure helpers for the recipe page, kept out of the components so they can
 * be unit-tested without a DOM: how many servings a recipe makes, which units
 * the switch starts on, which personal note belongs beside which ingredient or
 * step, the plain text of a step (for cook mode) and the metadata the facts grid
 * doesn't already show.
 */

import { facet } from '@/domain/recipe/taxonomy';
import { FAVOURITE_KEY } from '@/domain/recipe/favourite-tag';
import { MEDIA_META_KEYS } from '@/domain/recipe/media';
import {
  convertQuantity,
  isUnitSystem,
  scaleQuantity,
  type UnitSystem,
} from '@/lib/cooklang/units';
import type { Note } from '@/lib/cooklang/cook-text';
import type { StepToken } from '@/lib/cooklang/cooklang';

/** What the servings stepper starts on when a recipe doesn't say. */
export const DEFAULT_SERVINGS = 4;

/** The largest serving count the stepper offers, so a typo can't run away. */
export const MAX_SERVINGS = 99;

/**
 * How many people a recipe says it feeds, read from its `>> servings:` (or
 * `serves:`) metadata, or undefined when it doesn't say. The first whole number
 * wins ("4", "4-6", "Serves 4 people"); a value without one counts as unsaid.
 * The facts grid uses this so it never shows a made-up serving count.
 */
export function declaredServings(
  metadata: readonly (readonly [string, string])[],
): number | undefined {
  const value = metadata.find(([key]) => {
    const lower = key.toLowerCase();
    return lower === 'servings' || lower === 'serves';
  })?.[1];
  const parsed = Number.parseInt(/\d+/.exec(value ?? '')?.[0] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }
  return Math.min(parsed, MAX_SERVINGS);
}

/**
 * The number the servings stepper starts on: what the recipe says, or
 * {@link DEFAULT_SERVINGS} when it doesn't, so amounts can still be scaled.
 */
export function servingsOf(
  metadata: readonly (readonly [string, string])[],
): number {
  return declaredServings(metadata) ?? DEFAULT_SERVINGS;
}

/** What the units switch can be set to: the recipe's own units or a system. */
export type UnitChoice = 'original' | UnitSystem;

/**
 * Where the units switch starts: the user's saved preference when they have one,
 * otherwise the recipe as written.
 */
export function initialUnits(saved: string | null | undefined): UnitChoice {
  return saved && isUnitSystem(saved) ? saved : 'original';
}

/**
 * An amount as it should read once the visitor's servings and units are applied:
 * scaled by `factor` (people now over people the recipe is written for), then
 * converted unless they asked for the recipe's own units. Amounts without a
 * number ("a pinch") come back as written.
 */
export function displayQuantity(
  quantity: string,
  factor: number,
  units: UnitChoice,
): string {
  const scaled = scaleQuantity(quantity, factor);
  return units === 'original' || !scaled
    ? scaled
    : convertQuantity(scaled, units);
}

/** A note as the page shows it in the Notes section. */
export interface GeneralNote {
  /** What it is attached to, when it didn't land beside an ingredient or step. */
  readonly label?: string;
  readonly text: string;
}

/** Every note, sorted to the place it is shown. */
export interface GroupedNotes {
  /** Note texts per ingredient, in the same order as the ingredient list. */
  readonly byIngredient: readonly (readonly string[])[];
  /** Note texts per step, in the same order as the method. */
  readonly byStep: readonly (readonly string[])[];
  /** Whole-recipe notes, plus any note whose target can't be found. */
  readonly general: readonly GeneralNote[];
}

/** Where one note ends up on the page. */
type Placement =
  | {
      readonly kind: 'ingredient';
      readonly text: string;
      readonly ingredientIndexes: readonly number[];
    }
  | { readonly kind: 'step'; readonly text: string; readonly index: number }
  | { readonly kind: 'general'; readonly note: GeneralNote };

/** Whether an ingredient name and a note's target name refer to the same thing. */
function namesMatch(ingredient: string, target: string): boolean {
  return (
    target !== '' &&
    (ingredient === target ||
      ingredient.includes(target) ||
      target.includes(ingredient))
  );
}

/** Decide where one note goes; `lowered` are the lower-cased ingredient names. */
function placeNote(
  note: Readonly<Note>,
  lowered: readonly string[],
  stepCount: number,
): Placement {
  if (note.scope === 'general') {
    return { kind: 'general', note: { text: note.text } };
  }
  if (note.scope === 'step') {
    const index = Number.parseInt(note.key, 10) - 1;
    return index >= 0 && index < stepCount
      ? { kind: 'step', text: note.text, index }
      : {
          kind: 'general',
          note: { label: `Step ${note.key}`, text: note.text },
        };
  }
  const target = note.key.trim().toLowerCase();
  const ingredientIndexes = lowered.flatMap((name, index) =>
    namesMatch(name, target) ? [index] : [],
  );
  return ingredientIndexes.length > 0
    ? { kind: 'ingredient', text: note.text, ingredientIndexes }
    : { kind: 'general', note: { label: note.key, text: note.text } };
}

/**
 * Sort personal notes to where they belong. An ingredient note lands on every
 * ingredient whose name matches loosely (exact, or one contains the other), so a
 * note on "lime" sits beside "lime juice". A note whose ingredient or step no
 * longer exists isn't dropped; it moves to the general list with a label, so
 * nothing the user wrote ever disappears.
 */
export function groupNotes(
  notes: readonly Readonly<Note>[],
  ingredientNames: readonly string[],
  stepCount: number,
): GroupedNotes {
  const lowered = ingredientNames.map((name) => name.toLowerCase());
  const placements = notes.map((note) => placeNote(note, lowered, stepCount));
  return {
    byIngredient: ingredientNames.map((_, i) =>
      placements.flatMap((p) =>
        p.kind === 'ingredient' && p.ingredientIndexes.includes(i)
          ? [p.text]
          : [],
      ),
    ),
    byStep: Array.from({ length: stepCount }, (_, i) =>
      placements.flatMap((p) =>
        p.kind === 'step' && p.index === i ? [p.text] : [],
      ),
    ),
    general: placements.flatMap((p) => (p.kind === 'general' ? [p.note] : [])),
  };
}

/** The words of a step as plain text, ingredient and timer names included. */
export function stepText(tokens: readonly StepToken[]): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case 'text':
          return token.text;
        case 'timer':
          return token.label;
        default:
          return token.name;
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Metadata keys the page shows some other way, or never shows. */
const HANDLED_KEYS: ReadonlySet<string> = new Set([
  ...MEDIA_META_KEYS,
  FAVOURITE_KEY,
  'servings',
  'serves',
  'source',
  'time',
  'status',
  'created',
]);

/**
 * The metadata left over once the facts grid, the source line and the photos
 * have taken theirs (an author, a yield, anything a user typed by hand), so no
 * line of a recipe's file is hidden from the page.
 */
export function extraMetadata(
  metadata: readonly (readonly [string, string])[],
): readonly (readonly [string, string])[] {
  return metadata.filter(([key, value]) => {
    const lower = key.toLowerCase();
    return !HANDLED_KEYS.has(lower) && !facet(lower) && value.trim() !== '';
  });
}
