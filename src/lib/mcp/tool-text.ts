/**
 * @packageDocumentation
 *
 * Plain-text renderings of recipes and recipe lists for the `content` of a tool
 * result. The structured data (`structuredContent`) is what the card and list
 * views draw, but the MCP spec says `content` is what the model reads and what a
 * text-only host shows, and the MCP Apps guidance says hosts may keep
 * `structuredContent` out of the model's context entirely. So the text carries
 * the real data, readable on its own: a recipe's ingredients and steps, a list's
 * names with their ids.
 *
 * These are pure functions of the same data the views get, and they cap their
 * output so a huge collection or an unusually long recipe cannot flood the
 * model's context.
 */

import type { StepToken } from '../recipe/cooklang';
import type { RecipeCardData, RecipeListItem } from './ui-types';

/** The most recipes a list prints before saying how many more there are. */
export const LIST_TEXT_LIMIT = 200;

/** The most cooking-log entries a recipe prints (the newest ones). */
const LOG_TEXT_LIMIT = 10;

/** The longest recipe text returned, in characters. */
const CARD_TEXT_LIMIT = 12_000;

/** One list entry as a line: the name, and the id a later call can use to be exact. */
function itemLine(item: Readonly<RecipeListItem>): string {
  return `- ${item.title} (${item.uncurated ? 'idea, ' : ''}id: ${item.id})`;
}

/**
 * The recipes of a list, one per line with their ids, cut off after
 * {@link LIST_TEXT_LIMIT} with a note saying how many were left out. Empty when
 * the list is empty.
 */
export function listText(items: readonly RecipeListItem[]): string {
  const shown = items.slice(0, LIST_TEXT_LIMIT).map(itemLine);
  const left = items.length - shown.length;
  return left > 0
    ? [
        ...shown,
        `…and ${left} more not shown (search by name to find one).`,
      ].join('\n')
    : shown.join('\n');
}

/** A step as a sentence: the text with each ingredient spelled with its quantity. */
function stepText(step: readonly StepToken[]): string {
  return step
    .map((token) => {
      switch (token.kind) {
        case 'text':
          return token.text;
        case 'ingredient':
          return `${token.quantity} ${token.name}`.trim();
        case 'cookware':
          return token.name;
        case 'timer':
          return token.label;
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** An ingredient as a line: "200 g flour", or just "salt" when no amount is given. */
function ingredientLine(
  ingredient: RecipeCardData['ingredients'][number],
): string {
  return `- ${`${ingredient.quantity} ${ingredient.name}`.trim()}`;
}

/** A titled block of lines, or nothing when there are none. */
function section(title: string, lines: readonly string[]): readonly string[] {
  return lines.length > 0 ? ['', `${title}:`, ...lines] : [];
}

/**
 * A recipe as readable text: its title and id, the details worth knowing
 * (servings, times, cuisine…), the source, then ingredients with quantities, the
 * numbered method, cookware and the latest cooking-log entries. Sections that
 * are empty are left out. Quantities are already in the user's measurement
 * system, as in the card. Cut off after {@link CARD_TEXT_LIMIT} characters.
 */
export function cardText(card: Readonly<RecipeCardData>): string {
  const details = card.metadata.map(([key, value]) => `${key}: ${value}`);
  const steps = card.steps
    .map(stepText)
    .filter(Boolean)
    .map((text, index) => `${index + 1}. ${text}`);
  const logs = card.logs
    .slice(-LOG_TEXT_LIMIT)
    .map((entry) => `- ${entry.date}: ${entry.note}`);
  const text = [
    `${card.title} (${card.uncurated ? 'idea, not yet a full recipe, ' : ''}id: ${card.id})`,
    ...(details.length > 0 ? [details.join('; ')] : []),
    ...(card.source ? [`Source: ${card.source}`] : []),
    ...section('Ingredients', card.ingredients.map(ingredientLine)),
    ...section('Method', steps),
    ...section(
      'Cookware',
      card.cookware.length > 0 ? [card.cookware.join(', ')] : [],
    ),
    ...section('Cooking log', logs),
  ].join('\n');
  return text.length > CARD_TEXT_LIMIT
    ? `${text.slice(0, CARD_TEXT_LIMIT).trimEnd()}\n…(recipe text cut short)`
    : text;
}
