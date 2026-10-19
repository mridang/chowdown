/**
 * @packageDocumentation
 *
 * The chowdown recipe card, an MCP Apps View rendered inline in the chat client
 * when a recipe tool runs (get_recipe, add_recipe, import_recipe, capture_idea,
 * log_cooking). Inline mode is a compact card with a "View recipe" button that
 * asks the host for fullscreen; the expanded layout shows the full method,
 * ingredients and cooking log, and always has a way back. The drawing is in
 * {@link RecipeCardScreen} (pure, so it can be rendered in a test); the
 * connection to the host is in {@link RecipeCardApp}.
 */

import type { ReactElement } from 'react';

import type { RecipeCardData } from '../lib/mcp/ui-types';
import { isRecipeCardData } from './payload';
import { Eyebrow, FullRecipe, MetaRow } from './recipe-parts';
import { LoadingCard, MessageCard } from './status-panels';
import { STYLES } from './styles';
import { useWidgetData } from './use-widget-data';
import type { ViewState } from './view-state';

/** How many ingredients the compact card names before saying "+N more". */
const CHIPS_SHOWN = 7;

/** The compact inline card. */
function InlineCard({
  recipe,
  onView,
}: Readonly<{
  recipe: RecipeCardData;
  onView: () => void;
}>): ReactElement {
  const shown = recipe.ingredients.slice(0, CHIPS_SHOWN);
  const extra = recipe.ingredients.length - shown.length;
  return (
    <div className="wrap">
      <article className="card" aria-labelledby="recipe-title">
        <Eyebrow uncurated={recipe.uncurated} />
        <h1 className="title" id="recipe-title">
          {recipe.title}
        </h1>
        <MetaRow metadata={recipe.metadata} />
        {shown.length > 0 ? (
          <ul className="chips" aria-label="Ingredients">
            {shown.map((ingredient, i) => (
              <li className="chip" key={`${ingredient.name}-${i}`}>
                {ingredient.name}
              </li>
            ))}
            {extra > 0 ? <li className="chip more">+{extra} more</li> : null}
          </ul>
        ) : null}
        <div className="actions">
          <button type="button" className="btn" onClick={onView}>
            View recipe
          </button>
        </div>
      </article>
    </div>
  );
}

/** What {@link RecipeCardScreen} draws and the actions it can trigger. */
export interface RecipeCardScreenProps {
  readonly state: ViewState<RecipeCardData>;
  /** Whether the expanded layout is showing. */
  readonly expanded: boolean;
  readonly onExpand: () => void;
  readonly onCollapse: () => void;
  /** Opens a web page through the host; absent when the host cannot. */
  readonly onOpenLink: ((url: string) => void) | undefined;
}

/**
 * Draws the recipe card for a given state: a skeleton while waiting, a message
 * when there is nothing to show, otherwise the compact or the expanded recipe.
 */
export function RecipeCardScreen({
  state,
  expanded,
  onExpand,
  onCollapse,
  onOpenLink,
}: Readonly<RecipeCardScreenProps>): ReactElement {
  const body = ((): ReactElement => {
    switch (state.phase) {
      case 'connecting':
      case 'waiting':
        return (
          <LoadingCard
            noun="recipe"
            request={state.phase === 'waiting' ? state.request : undefined}
          />
        );
      case 'failed':
        return <MessageCard reason={state.reason} message={state.message} />;
      case 'ready':
        return expanded ? (
          <FullRecipe
            recipe={state.data}
            onBack={onCollapse}
            onOpenLink={onOpenLink}
          />
        ) : (
          <InlineCard recipe={state.data} onView={onExpand} />
        );
    }
  })();
  return (
    <>
      <style>{STYLES}</style>
      {body}
    </>
  );
}

/** The View: connects to the host and draws the recipe card. */
export function RecipeCardApp(): ReactElement {
  const bridge = useWidgetData('chowdown-recipe-card', isRecipeCardData);
  return (
    <RecipeCardScreen
      state={bridge.state}
      expanded={bridge.expanded}
      onExpand={() => void bridge.expand()}
      onCollapse={() => void bridge.collapse()}
      onOpenLink={bridge.openLink}
    />
  );
}
