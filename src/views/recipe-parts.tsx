/**
 * @packageDocumentation
 *
 * The pieces of a recipe that more than one View draws: the recipe's meta row,
 * a method step with its highlighted ingredient/cookware/timer tokens, and the
 * full-width recipe layout. The recipe card View uses them for its expanded
 * mode and the recipe list View reuses them when it has to show a recipe
 * itself (hosts that cannot send a message back to the chat).
 */

import type { ReactElement } from 'react';

import type { StepToken } from '../lib/recipe/cooklang';
import type { RecipeCardData } from '../lib/mcp/ui-types';
import { safeHttpUrl } from './follow-up';

/** The small label above a title: "Recipe" or "Recipe idea". */
export function Eyebrow({
  uncurated,
}: Readonly<{ uncurated: boolean }>): ReactElement {
  return (
    <div className="eyebrow">
      <span className="dot" aria-hidden="true" />
      {uncurated ? 'Recipe idea' : 'Recipe'}
    </div>
  );
}

/** The row of facts under a title (servings, time, cuisine…), or nothing if there are none. */
export function MetaRow({
  metadata,
}: Readonly<{ metadata: RecipeCardData['metadata'] }>): ReactElement | null {
  return metadata.length > 0 ? (
    <div className="meta">
      {metadata.map(([key, value], i) => (
        <span key={key}>
          {i > 0 ? (
            <span className="sep" aria-hidden="true">
              ·&nbsp;
            </span>
          ) : null}
          <b>{key}</b> {value}
        </span>
      ))}
    </div>
  ) : null;
}

/** One piece of a method step. */
function Token({ token }: Readonly<{ token: StepToken }>): ReactElement {
  switch (token.kind) {
    case 'text':
      return <span>{token.text}</span>;
    case 'ingredient':
      return (
        <span className="tok-ing">
          {token.name}
          {token.quantity ? (
            <span className="tok-q"> ({token.quantity})</span>
          ) : null}
        </span>
      );
    case 'cookware':
      return <span className="tok-cook">{token.name}</span>;
    case 'timer':
      return <span className="tok-timer">{token.label}</span>;
  }
}

/** Render one Cooklang step as text with highlighted ingredient/cookware/timer tokens. */
export function Step({
  tokens,
}: Readonly<{ tokens: readonly StepToken[] }>): ReactElement {
  return (
    <p>
      {tokens.map((token, i) => (
        <Token key={i} token={token} />
      ))}
    </p>
  );
}

/**
 * Moves keyboard focus to an element when it first appears. A module-level
 * function on purpose: React calls a ref callback again whenever its identity
 * changes, and an inline arrow would steal focus on every re-render.
 */
function focusWhenShown(element: HTMLElement | null): void {
  element?.focus({ preventScroll: true });
}

/** What the full recipe layout needs from its View. */
export interface FullRecipeProps {
  readonly recipe: RecipeCardData;
  /** Leave the expanded layout. Shown as a "Back" button when given. */
  readonly onBack?: () => void;
  /** Open a web page through the host. The source link is shown only when given. */
  readonly onOpenLink?: (url: string) => void;
}

/**
 * The expanded recipe: ingredients, cookware, method and cooking log. Takes
 * keyboard focus when it appears (the control that opened it has just gone away,
 * and focus would otherwise be lost), and offers a way back.
 */
export function FullRecipe({
  recipe,
  onBack,
  onOpenLink,
}: Readonly<FullRecipeProps>): ReactElement {
  const source = safeHttpUrl(recipe.source);
  return (
    <section
      className="full"
      aria-labelledby="recipe-title"
      tabIndex={-1}
      ref={focusWhenShown}
    >
      {onBack ? (
        <div className="toolbar">
          <button type="button" className="btn ghost" onClick={onBack}>
            Back
          </button>
        </div>
      ) : null}
      <Eyebrow uncurated={recipe.uncurated} />
      <h1 className="title" id="recipe-title">
        {recipe.title}
      </h1>
      <MetaRow metadata={recipe.metadata} />
      {source && onOpenLink ? (
        <button
          type="button"
          className="link"
          onClick={() => onOpenLink(source)}
        >
          Open the original recipe
        </button>
      ) : null}
      <div className="cols">
        <aside className="panel" aria-labelledby="ingredients-heading">
          <h2 className="h2" id="ingredients-heading">
            Ingredients
          </h2>
          <ul className="ings">
            {recipe.ingredients.map((ingredient, i) => (
              <li className="ing" key={`${ingredient.name}-${i}`}>
                <span>{ingredient.name}</span>
                {ingredient.quantity ? (
                  <span className="q">{ingredient.quantity}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {recipe.cookware.length > 0 ? (
            <>
              <h2 className="h2 spaced">Cookware</h2>
              <ul className="cooks">
                {recipe.cookware.map((item, i) => (
                  <li className="cook" key={`${item}-${i}`}>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
        <section className="panel" aria-labelledby="method-heading">
          <h2 className="h2" id="method-heading">
            Method
          </h2>
          <ol className="steps">
            {recipe.steps.map((tokens, i) => (
              <li className="step" key={i}>
                <span className="num" aria-hidden="true">
                  {i + 1}
                </span>
                <Step tokens={tokens} />
              </li>
            ))}
          </ol>
          {recipe.logs.length > 0 ? (
            <div className="logs">
              <h2 className="h2">Cooking log</h2>
              {recipe.logs.map((entry, i) => (
                <div className="log" key={i}>
                  <span className="d">{entry.date}</span> — {entry.note}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
