/**
 * @packageDocumentation
 *
 * Small pure helpers for the recipe page, kept out of the components so they can
 * be unit-tested without a DOM: how many servings a recipe makes, which units
 * the switch starts on, which personal note belongs beside which ingredient or
 * step, the plain text of a step (for cook mode) and the metadata the facts grid
 * doesn't already show.
 */

import { facet } from './taxonomy';
import { FAVOURITE_KEY } from './favourite-tag';
import { MEDIA_META_KEYS } from './media';
import {
  convertQuantity,
  isUnitSystem,
  scaleQuantity,
  type UnitSystem,
} from './units';
import type { Note } from './cook-text';
import type { StepToken } from './cooklang';

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
  metadata: [string, string][],
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
export function servingsOf(metadata: [string, string][]): number {
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
  label?: string;
  text: string;
}

/** Every note, sorted to the place it is shown. */
export interface GroupedNotes {
  /** Note texts per ingredient, in the same order as the ingredient list. */
  byIngredient: string[][];
  /** Note texts per step, in the same order as the method. */
  byStep: string[][];
  /** Whole-recipe notes, plus any note whose target can't be found. */
  general: GeneralNote[];
}

/**
 * Sort personal notes to where they belong. An ingredient note lands on every
 * ingredient whose name matches loosely (exact, or one contains the other), so a
 * note on "lime" sits beside "lime juice". A note whose ingredient or step no
 * longer exists isn't dropped; it moves to the general list with a label, so
 * nothing the user wrote ever disappears.
 */
export function groupNotes(
  notes: Note[],
  ingredientNames: string[],
  stepCount: number,
): GroupedNotes {
  const byIngredient: string[][] = ingredientNames.map(() => []);
  const byStep: string[][] = Array.from({ length: stepCount }, () => []);
  const general: GeneralNote[] = [];
  const lowered = ingredientNames.map((name) => name.toLowerCase());

  for (const note of notes) {
    if (note.scope === 'general') {
      general.push({ text: note.text });
    } else if (note.scope === 'step') {
      const index = Number.parseInt(note.key, 10) - 1;
      if (index >= 0 && index < stepCount) {
        byStep[index]!.push(note.text);
      } else {
        general.push({ label: `Step ${note.key}`, text: note.text });
      }
    } else {
      const key = note.key.trim().toLowerCase();
      let placed = false;
      lowered.forEach((name, index) => {
        if (key && (name === key || name.includes(key) || key.includes(name))) {
          byIngredient[index]!.push(note.text);
          placed = true;
        }
      });
      if (!placed) {
        general.push({ label: note.key, text: note.text });
      }
    }
  }
  return { byIngredient, byStep, general };
}

/** The words of a step as plain text, ingredient and timer names included. */
export function stepText(tokens: StepToken[]): string {
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
const HANDLED_KEYS = new Set([
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
  metadata: [string, string][],
): [string, string][] {
  return metadata.filter(([key, value]) => {
    const lower = key.toLowerCase();
    return !HANDLED_KEYS.has(lower) && !facet(lower) && value.trim() !== '';
  });
}
