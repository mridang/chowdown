/**
 * @packageDocumentation
 *
 * The shapes of this app's `structuredContent`, checked before a View draws
 * them: the payload is untrusted input, so a View never trusts a cast. The
 * reading of a result around these guards is shared (`payload.ts`).
 */

import type { RecipeCardData, RecipeListData } from '@/domain/mcp/ui-types';
import { everyEntry, isRecord, isString } from '@/views/payload';

/** Whether the value is an array of arrays (the shape of recipe steps). */
function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Whether the card's identifying fields and its log are the right shape. */
function hasCardText(value: Readonly<Record<string, unknown>>): boolean {
  return (
    isString(value['id']) &&
    isString(value['title']) &&
    typeof value['uncurated'] === 'boolean' &&
    everyEntry(value['logs'], isRecord)
  );
}

/** Whether the card's ingredient, cookware and step lists are the right shape. */
function hasCardParts(value: Readonly<Record<string, unknown>>): boolean {
  return (
    everyEntry(value['metadata'], isArray) &&
    everyEntry(value['ingredients'], isRecord) &&
    everyEntry(value['cookware'], isString) &&
    everyEntry(value['steps'], isArray)
  );
}

/** Whether the value has the shape of the recipe card's `structuredContent`. */
export function isRecipeCardData(value: unknown): value is RecipeCardData {
  return isRecord(value) && hasCardText(value) && hasCardParts(value);
}

/** Whether the value has the shape of the recipe list's `structuredContent`. */
export function isRecipeListData(value: unknown): value is RecipeListData {
  return (
    isRecord(value) &&
    everyEntry(
      value['recipes'],
      (entry) =>
        isRecord(entry) && isString(entry['id']) && isString(entry['title']),
    )
  );
}
