/**
 * @packageDocumentation
 *
 * The chowdown recipe list, an MCP Apps View rendered when list_recipes,
 * search_recipes or the other list tools run. Shows the user's recipes as a
 * tappable grid. Tapping a recipe asks the assistant to open it (a follow-up
 * turn that fires get_recipe, which renders the recipe card), using whichever
 * route the host supports; a host that offers no way to message the chat but
 * does run tools gets the recipe fetched and shown right here instead.
 */

import { useCallback, useReducer, type ReactElement } from 'react';

import type { RecipeListData, RecipeListItem } from '../lib/mcp/ui-types';
import { openRecipePrompt } from './follow-up';
import {
  INITIAL_LIST_STATE,
  reduceListState,
  type ListState,
} from './list-state';
import { isRecipeCardData, isRecipeListData } from './payload';
import { FullRecipe } from './recipe-parts';
import { LoadingCard, MessageCard } from './status-panels';
import { STYLES } from './styles';
import { useWidgetData } from './use-widget-data';
import type { ViewState } from './view-state';

/** The recipes as a grid of tiles. */
function RecipeGrid({
  data,
  pendingId,
  onOpen,
}: Readonly<{
  data: RecipeListData;
  pendingId: string | undefined;
  onOpen: (recipe: RecipeListItem) => void;
}>): ReactElement {
  const { recipes, query } = data;
  return (
    <>
      <div className="list-head">
        <h1>{query ? `Recipes matching “${query}”` : 'Your recipes'}</h1>
        <span className="count">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      {recipes.length === 0 ? (
        <div className="empty" role="status">
          {query ? 'No recipes matched.' : 'No recipes yet.'}
        </div>
      ) : (
        <ul className="grid" aria-label="Recipes">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="tile"
                aria-busy={pendingId === recipe.id}
                onClick={() => onOpen(recipe)}
              >
                <span className="name">{recipe.title}</span>
                {recipe.uncurated ? (
                  <span className="badge">idea</span>
                ) : (
                  <span className="arrow" aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** What {@link RecipeListScreen} draws and the actions it can trigger. */
export interface RecipeListScreenProps {
  readonly state: ViewState<RecipeListData>;
  /** What the person's last tap led to. */
  readonly list: ListState;
  readonly onOpen: (recipe: RecipeListItem) => void;
  readonly onCloseDetail: () => void;
  /** Opens a web page through the host; absent when the host cannot. */
  readonly onOpenLink: ((url: string) => void) | undefined;
}

/**
 * Draws the recipe list for a given state: a skeleton while waiting, a message
 * when there is nothing to show, otherwise the grid (or, after a tap that the
 * View handled itself, the recipe that was fetched).
 */
export function RecipeListScreen({
  state,
  list,
  onOpen,
  onCloseDetail,
  onOpenLink,
}: Readonly<RecipeListScreenProps>): ReactElement {
  const body = ((): ReactElement => {
    switch (state.phase) {
      case 'connecting':
      case 'waiting':
        return (
          <LoadingCard
            noun="recipes"
            request={state.phase === 'waiting' ? state.request : undefined}
          />
        );
      case 'failed':
        return <MessageCard reason={state.reason} message={state.message} />;
      case 'ready':
        break;
    }
    if (list.detail.status === 'ready') {
      return (
        <FullRecipe
          recipe={list.detail.recipe}
          onBack={onCloseDetail}
          onOpenLink={onOpenLink}
        />
      );
    }
    if (list.detail.status === 'loading') {
      return <LoadingCard noun="recipe" request={list.detail.title} />;
    }
    if (list.detail.status === 'failed') {
      return (
        <div className="wrap">
          <div className="toolbar">
            <button type="button" className="btn ghost" onClick={onCloseDetail}>
              Back
            </button>
          </div>
          <MessageCard reason="error" message={list.detail.message} />
        </div>
      );
    }
    return (
      <div className="wrap">
        {state.phase === 'ready' ? (
          <RecipeGrid
            data={state.data}
            pendingId={list.pendingId}
            onOpen={onOpen}
          />
        ) : null}
        {list.notice ? (
          <div className="status-line" role="status">
            {list.notice}
          </div>
        ) : null}
      </div>
    );
  })();
  return (
    <>
      <style>{STYLES}</style>
      {body}
    </>
  );
}

/** The View: connects to the host and draws the recipe list. */
export function RecipeListApp(): ReactElement {
  const bridge = useWidgetData('chowdown-recipe-list', isRecipeListData);
  const [list, dispatch] = useReducer(reduceListState, INITIAL_LIST_STATE);
  const { sendFollowUp, canCallTools, callTool } = bridge;

  const open = useCallback(
    async (recipe: RecipeListItem) => {
      dispatch({ type: 'tapped', id: recipe.id });
      if (await sendFollowUp(openRecipePrompt(recipe.title))) {
        dispatch({ type: 'asked-assistant', title: recipe.title });
      } else if (canCallTools) {
        dispatch({ type: 'fetching', title: recipe.title });
        const outcome = await callTool(
          'get_recipe',
          { name: recipe.title },
          isRecipeCardData,
        );
        dispatch({ type: 'fetched', title: recipe.title, outcome });
      } else {
        dispatch({ type: 'unavailable', title: recipe.title });
      }
    },
    [sendFollowUp, canCallTools, callTool],
  );

  return (
    <RecipeListScreen
      state={bridge.state}
      list={list}
      onOpen={(recipe) => void open(recipe)}
      onCloseDetail={() => dispatch({ type: 'closed-detail' })}
      onOpenLink={bridge.openLink}
    />
  );
}
