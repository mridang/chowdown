/**
 * @packageDocumentation
 *
 * What the recipe list View remembers about the tile the person tapped. A tap
 * can end three ways: the assistant was asked to open the recipe (the answer
 * shows up in the chat), the View fetched the recipe itself through the host
 * and shows it in place, or neither was possible and the View says so. This
 * reducer holds that outcome so the rules are testable without a browser.
 */

import type { RecipeCardData } from '../lib/mcp/ui-types';
import type { ToolOutcome } from './payload';

/** The recipe the View is showing in place of the list, if any. */
export type DetailState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading'; readonly title: string }
  | { readonly status: 'ready'; readonly recipe: RecipeCardData }
  | {
      readonly status: 'failed';
      readonly title: string;
      readonly message: string;
    };

/** Everything the list View remembers about taps. */
export interface ListState {
  readonly detail: DetailState;
  /** The tile waiting for an answer, so it can show it is busy. */
  readonly pendingId: string | undefined;
  /** A short line telling the person what happened to their tap. */
  readonly notice: string | undefined;
}

/** The state before anything has been tapped. */
export const INITIAL_LIST_STATE: ListState = {
  detail: { status: 'closed' },
  pendingId: undefined,
  notice: undefined,
};

/** Something that happened after a tap. */
export type ListAction =
  | {
      /** A tile was tapped and the View is working out how to open it. */
      readonly type: 'tapped';
      readonly id: string;
    }
  | {
      /** The assistant was asked, in the conversation, to open the recipe. */
      readonly type: 'asked-assistant';
      readonly title: string;
    }
  | {
      /** The View is fetching the recipe through the host. */
      readonly type: 'fetching';
      readonly title: string;
    }
  | {
      /** The fetch finished (with a recipe, or with a message). */
      readonly type: 'fetched';
      readonly title: string;
      readonly outcome: ToolOutcome<RecipeCardData>;
    }
  | {
      /** Neither route was available. */
      readonly type: 'unavailable';
      readonly title: string;
    }
  | { readonly type: 'closed-detail' };

/** The next list state. */
export function reduceListState(
  state: ListState,
  action: ListAction,
): ListState {
  switch (action.type) {
    case 'tapped':
      return { ...state, pendingId: action.id, notice: undefined };
    case 'asked-assistant':
      return {
        ...state,
        pendingId: undefined,
        notice: `Asked the assistant to open “${action.title}”.`,
      };
    case 'fetching':
      return {
        ...state,
        detail: { status: 'loading', title: action.title },
      };
    case 'fetched':
      return {
        ...state,
        pendingId: undefined,
        detail:
          action.outcome.kind === 'data'
            ? { status: 'ready', recipe: action.outcome.data }
            : {
                status: 'failed',
                title: action.title,
                message: action.outcome.text,
              },
      };
    case 'unavailable':
      return {
        ...state,
        pendingId: undefined,
        notice: `This app cannot open recipes by itself here. Ask the assistant to open “${action.title}”.`,
      };
    case 'closed-detail':
      return { ...state, detail: { status: 'closed' } };
  }
}
