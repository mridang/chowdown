/**
 * @packageDocumentation
 *
 * What happens when the person taps a recipe in the list: the steps, in order,
 * with the host's abilities passed in so the decision can be tested without a
 * browser. A recipe is always identified by its id, never by its title: titles
 * are third-party text (imported pages, file names) that must not be written
 * into a message the host shows as the person's own, and two recipes can share
 * a display name.
 */

import type { RecipeCardData, RecipeListItem } from '@/domain/mcp/ui-types';
import type { ListAction } from '@/views/list-state';
import { type ToolOutcome } from '@/views/payload';
import { isRecipeCardData } from '@/views/guards';

/**
 * What a Drive file id looks like: letters, digits, `_` and `-`. Anything else
 * in an "id" cannot be a real one, and the id is the only part of a recipe that
 * is allowed into a message the person appears to have written.
 */
const RECIPE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Whether `value` has the shape of a recipe (Drive file) id. */
export function isRecipeId(value: string): boolean {
  return RECIPE_ID_PATTERN.test(value);
}

/**
 * The sentence a tile sends to ask the assistant to open a recipe, or undefined
 * when the id is not a plain id (so nothing is sent at all).
 *
 * A follow-up is shown by the host as if the person had typed it, and a recipe
 * title is text from an imported web page or a file name: anyone who can get a
 * recipe into the account could write instructions into it. So the message is a
 * fixed phrase plus the id, which has a closed alphabet and cannot carry any.
 */
export function openRecipePrompt(id: string): string | undefined {
  return isRecipeId(id) ? `Open the saved recipe with id ${id}` : undefined;
}

/** The tool a tap falls back to when the host cannot carry a message. */
export const OPEN_RECIPE_TOOL = 'get_recipe';

/** What a tap can use, from the host connection. */
export interface OpenRecipeHost {
  /** Send a message to the conversation; true when a route accepted it. */
  readonly sendFollowUp: (prompt: string) => Promise<boolean>;
  /** Whether the host will run a tool for the View. */
  readonly canCallTools: boolean;
  /** Run a server tool through the host. */
  readonly callTool: (
    name: string,
    args: Readonly<Record<string, unknown>>,
    guard: (value: unknown) => value is RecipeCardData,
  ) => Promise<ToolOutcome<RecipeCardData>>;
  /** Whether the expanded layout is showing (it would cover the reply). */
  readonly expanded: boolean;
  /** Leave the expanded layout. */
  readonly collapse: () => Promise<void>;
}

/**
 * Open one recipe: ask the assistant to (a fixed phrase and the id), and if the
 * host has no way to message the chat but can run tools, fetch the recipe by id
 * and show it in place; failing both, say so.
 * @param recipe - The tile that was tapped.
 * @param host - What the host connection allows.
 * @param dispatch - Receives what happened, for the list's state.
 */
export async function openRecipe(
  recipe: RecipeListItem,
  host: OpenRecipeHost,
  dispatch: (action: ListAction) => void,
): Promise<void> {
  dispatch({ type: 'tapped', id: recipe.id });
  const prompt = openRecipePrompt(recipe.id);
  if (prompt !== undefined && (await host.sendFollowUp(prompt))) {
    dispatch({ type: 'asked-assistant', title: recipe.title });
    // The answer appears in the conversation, so leave the expanded layout
    // that would be covering it.
    if (host.expanded) {
      await host.collapse();
    }
    return;
  }
  if (!host.canCallTools) {
    dispatch({ type: 'unavailable', title: recipe.title });
    return;
  }
  dispatch({ type: 'fetching', title: recipe.title });
  const outcome = await host.callTool(
    OPEN_RECIPE_TOOL,
    { recipe: recipe.id },
    isRecipeCardData,
  );
  dispatch({ type: 'fetched', title: recipe.title, outcome });
}
