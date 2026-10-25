/**
 * @packageDocumentation
 *
 * What the recipe list View remembers about the tile the person tapped. A tap
 * can end three ways: the assistant was asked to open the recipe (the answer
 * shows up in the chat), the View fetched the recipe itself through the host
 * and shows it in place, or neither was possible and the View says so. This
 * reducer holds that outcome so the rules are testable without a browser.
 */

import type { RecipeCardData, RecipeListItem } from '@/domain/mcp/ui-types';
import type { ToolOutcome } from '@/views/payload';

/**
 * How many recipes the inline list draws before offering "Show all". Chat hosts
 * clip an inline frame at a fixed height and, on a phone, give vertical
 * swipes inside it to the conversation, so a long list would be unreachable;
 * ChatGPT's guidelines ask for "show more" rather than inner scrolling too.
 */
export const INLINE_TILE_LIMIT = 8;

/** The longest recipe title the View repeats in its own sentences. */
const NOTICE_TITLE_LIMIT = 80;

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
  /** What the person typed in the expanded list's filter box. */
  readonly filter: string;
  /**
   * True right after the person came back from a recipe shown in place, so the
   * list can put keyboard focus back (the button they used has gone away).
   */
  readonly refocus: boolean;
}

/** The state before anything has been tapped. */
export const INITIAL_LIST_STATE: ListState = {
  detail: { status: 'closed' },
  pendingId: undefined,
  notice: undefined,
  filter: '',
  refocus: false,
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
  | { readonly type: 'closed-detail' }
  | {
      /** The person typed in the filter box. */
      readonly type: 'filter-changed';
      readonly value: string;
    };

/**
 * A recipe title made safe to repeat in a sentence: control and format
 * characters (which include the bidirectional overrides) and line breaks are
 * dropped, whitespace collapsed, and a long title cut. Titles are third-party
 * text; the View only ever echoes them as plain text, but it should not echo
 * something that can reorder the sentence around it or fill the screen.
 */
export function shortTitle(title: string): string {
  const flat = title
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > NOTICE_TITLE_LIMIT
    ? `${flat.slice(0, NOTICE_TITLE_LIMIT - 1)}…`
    : flat;
}

/** Lower-case text without accents, for matching what the person typed. */
function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** What the list draws: the tiles to show and how many there are in all. */
export interface VisibleRecipes {
  readonly shown: readonly RecipeListItem[];
  /** How many recipes match the filter (all of them when it is empty). */
  readonly matching: number;
  /** How many matching recipes are not drawn (only inline, past the limit). */
  readonly hidden: number;
}

/**
 * The tiles to draw. The expanded list shows every recipe whose title contains
 * the filter (ignoring case and accents); the inline list shows only the first
 * {@link INLINE_TILE_LIMIT} and ignores the filter, which only exists when
 * expanded.
 */
export function visibleRecipes(
  recipes: readonly RecipeListItem[],
  options: Readonly<{ expanded: boolean; filter: string }>,
): VisibleRecipes {
  if (!options.expanded) {
    return {
      shown: recipes.slice(0, INLINE_TILE_LIMIT),
      matching: recipes.length,
      hidden: Math.max(0, recipes.length - INLINE_TILE_LIMIT),
    };
  }
  const needle = plain(options.filter.trim());
  const shown =
    needle === ''
      ? recipes
      : recipes.filter((recipe) => plain(recipe.title).includes(needle));
  return { shown, matching: shown.length, hidden: 0 };
}

/** The next list state. */
export function reduceListState(
  state: ListState,
  action: ListAction,
): ListState {
  switch (action.type) {
    case 'tapped':
      return {
        ...state,
        pendingId: action.id,
        notice: undefined,
        refocus: false,
      };
    case 'asked-assistant':
      return {
        ...state,
        pendingId: undefined,
        notice: `Asked the assistant to open “${shortTitle(action.title)}”.`,
      };
    case 'fetching':
      return {
        ...state,
        detail: { status: 'loading', title: shortTitle(action.title) },
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
                title: shortTitle(action.title),
                message: action.outcome.text,
              },
      };
    case 'unavailable':
      return {
        ...state,
        pendingId: undefined,
        notice: `This app cannot open recipes by itself here. Ask the assistant to open “${shortTitle(action.title)}”.`,
      };
    case 'closed-detail':
      return { ...state, detail: { status: 'closed' }, refocus: true };
    case 'filter-changed':
      return { ...state, filter: action.value };
  }
}
