/* eslint-disable tailwindcss/no-custom-classname -- the widget's classes are defined in src/views/styles.ts, not in a CSS file. */
/**
 * @packageDocumentation
 *
 * The chowdown recipe list, an MCP Apps View rendered when list_recipes,
 * search_recipes or the other list tools run. Shows the user's recipes as a
 * tappable grid. Tapping a recipe asks the assistant to open it (a follow-up
 * turn that fires get_recipe, which renders the recipe card), using whichever
 * route the host supports; a host that offers no way to message the chat but
 * does run tools gets the recipe fetched and shown right here instead.
 *
 * Recipe titles are text from imported pages and file names, so they are only
 * ever drawn, never sent: a tap identifies its recipe by id (see
 * {@link openRecipePrompt}). Inline, the list draws a handful of tiles and
 * offers "Show all", because a chat host clips an inline frame; the expanded
 * layout draws every recipe and a filter box.
 */

import { useCallback, useReducer, type ReactElement } from 'react';

import type { RecipeListData, RecipeListItem } from '../lib/mcp/ui-types';
import {
  INITIAL_LIST_STATE,
  reduceListState,
  visibleRecipes,
  type ListState,
} from './list-state';
import { openRecipe } from './open-recipe';
import { isRecipeListData } from './payload';
import { CloseHint, FullRecipe, focusWhenShown } from './recipe-parts';
import { Announcer, LoadingCard, MessageCard } from './status-panels';
import { STYLES } from './styles';
import { useWidgetData } from './use-widget-data';
import type { ViewState } from './view-state';

/** What {@link RecipeGrid} needs besides the recipes themselves. */
interface RecipeGridProps {
  readonly data: RecipeListData;
  readonly pendingId: string | undefined;
  readonly onOpen: (recipe: RecipeListItem) => void;
  /** Whether the expanded layout (every recipe, with a filter) is showing. */
  readonly expanded: boolean;
  readonly filter: string;
  readonly onFilter: (value: string) => void;
  /** Take keyboard focus (the person has just come back from a recipe). */
  readonly refocus: boolean;
  readonly onExpand: () => void;
}

/** The recipes as a grid of tiles, with the controls that go with the layout. */
function RecipeGrid({
  data,
  pendingId,
  onOpen,
  expanded,
  filter,
  onFilter,
  refocus,
  onExpand,
}: Readonly<RecipeGridProps>): ReactElement {
  const { recipes, query } = data;
  const { shown, matching, hidden } = visibleRecipes(recipes, {
    expanded,
    filter,
  });
  const count = `${matching} ${matching === 1 ? 'recipe' : 'recipes'}`;
  return (
    <>
      <div className="list-head">
        <h1 tabIndex={-1} ref={refocus ? focusWhenShown : undefined}>
          {query ? `Recipes matching “${query}”` : 'Your recipes'}
        </h1>
        <span className="count">
          {expanded && matching !== recipes.length
            ? `${count} of ${recipes.length}`
            : count}
        </span>
      </div>
      {expanded && recipes.length > 0 ? (
        <input
          type="search"
          className="filter"
          aria-label="Filter recipes by name"
          placeholder="Filter by name"
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
        />
      ) : null}
      {shown.length === 0 ? (
        <div className="empty" role="status">
          {query || filter ? 'No recipes matched.' : 'No recipes yet.'}
        </div>
      ) : (
        <ul className="grid" aria-label="Recipes">
          {shown.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="tile"
                title={recipe.title}
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
      {hidden > 0 ? (
        <div className="more-row">
          <button type="button" className="btn ghost" onClick={onExpand}>
            Show all {matching} recipes
          </button>
        </div>
      ) : null}
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
  /** Whether the expanded layout is showing. */
  readonly expanded: boolean;
  readonly onExpand: () => void;
  readonly onCollapse: () => void;
  /** The person typed in the filter box. */
  readonly onFilter: (value: string) => void;
  /** True when the host would not leave fullscreen: shows where its own close control is. */
  readonly closeHint: boolean;
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
  expanded,
  onExpand,
  onCollapse,
  onFilter,
  closeHint,
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
      <div className={expanded ? 'full' : 'wrap'}>
        {expanded ? (
          <div className="toolbar">
            <button type="button" className="btn ghost" onClick={onCollapse}>
              Back
            </button>
            {closeHint ? <CloseHint /> : null}
          </div>
        ) : null}
        {state.phase === 'ready' ? (
          <RecipeGrid
            data={state.data}
            pendingId={list.pendingId}
            onOpen={onOpen}
            expanded={expanded}
            filter={list.filter}
            onFilter={onFilter}
            refocus={list.refocus}
            onExpand={onExpand}
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
      <Announcer
        message={
          state.phase === 'ready'
            ? `${state.data.recipes.length} recipes loaded`
            : ''
        }
      />
      {body}
    </>
  );
}

/** The View: connects to the host and draws the recipe list. */
export function RecipeListApp(): ReactElement {
  const bridge = useWidgetData('chowdown-recipe-list', isRecipeListData);
  const [list, dispatch] = useReducer(reduceListState, INITIAL_LIST_STATE);
  const { sendFollowUp, canCallTools, callTool, expanded, collapse } = bridge;

  const open = useCallback(
    (recipe: RecipeListItem) =>
      openRecipe(
        recipe,
        { sendFollowUp, canCallTools, callTool, expanded, collapse },
        dispatch,
      ),
    [sendFollowUp, canCallTools, callTool, expanded, collapse],
  );

  return (
    <RecipeListScreen
      state={bridge.state}
      list={list}
      onOpen={(recipe) => void open(recipe)}
      onCloseDetail={() => dispatch({ type: 'closed-detail' })}
      expanded={expanded}
      onExpand={() => void bridge.expand()}
      onCollapse={() => void collapse()}
      onFilter={(value) => dispatch({ type: 'filter-changed', value })}
      closeHint={bridge.closeHint}
      onOpenLink={bridge.openLink}
    />
  );
}
