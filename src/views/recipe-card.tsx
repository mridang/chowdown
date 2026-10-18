/**
 * The chowdown recipe card — an MCP Apps View rendered inline in the chat
 * client when a recipe tool runs (get_recipe, add_recipe, import_recipe,
 * capture_idea, log_cooking). Inline mode is a compact card with a "View
 * recipe" button that requests fullscreen; fullscreen shows the full method,
 * ingredients and cooking log. Data + host actions come through the shared
 * {@link useWidgetData} bridge (ChatGPT `window.openai` + ext-apps).
 */

import { createRoot } from 'react-dom/client';

import type { RecipeCardData } from '../lib/mcp/ui-types';
import { STYLES } from './styles';
import { useWidgetData } from './use-widget-data';

/** Render one Cooklang step as text with highlighted ingredient/cookware/timer tokens. */
function Step({ recipe, index }: { recipe: RecipeCardData; index: number }) {
  const step = recipe.steps[index] ?? [];
  return (
    <p>
      {step.map((t, i) => {
        if (t.kind === 'text') return <span key={i}>{t.text}</span>;
        if (t.kind === 'ingredient')
          return (
            <span key={i} className="tok-ing" title={t.quantity}>
              {t.name}
            </span>
          );
        if (t.kind === 'cookware')
          return (
            <span key={i} className="tok-cook">
              {t.name}
            </span>
          );
        return (
          <span key={i} className="tok-timer">
            {t.label}
          </span>
        );
      })}
    </p>
  );
}

/** The compact inline card. */
function InlineCard({
  recipe,
  onView,
}: {
  recipe: RecipeCardData;
  onView: () => void;
}) {
  const shown = recipe.ingredients.slice(0, 7);
  const extra = recipe.ingredients.length - shown.length;
  return (
    <div className="wrap">
      <div className="card">
        <div className="eyebrow">
          <span className="dot" />
          {recipe.uncurated ? 'Recipe idea' : 'Recipe'}
        </div>
        <h1 className="title">{recipe.title}</h1>
        {recipe.metadata.length > 0 ? (
          <div className="meta">
            {recipe.metadata.map(([k, v], i) => (
              <span key={k}>
                {i > 0 ? <span className="sep">·&nbsp;</span> : null}
                <b>{k}</b> {v}
              </span>
            ))}
          </div>
        ) : null}
        {shown.length > 0 ? (
          <div className="chips">
            {shown.map((ing, i) => (
              <span className="chip" key={`${ing.name}-${i}`}>
                {ing.name}
              </span>
            ))}
            {extra > 0 ? (
              <span className="chip more">+{extra} more</span>
            ) : null}
          </div>
        ) : null}
        <div className="actions">
          <button type="button" className="btn" onClick={onView}>
            View recipe
          </button>
        </div>
      </div>
    </div>
  );
}

/** The expanded fullscreen recipe. */
function FullRecipe({ recipe }: { recipe: RecipeCardData }) {
  return (
    <div className="full">
      <div className="eyebrow">
        <span className="dot" />
        {recipe.uncurated ? 'Recipe idea' : 'Recipe'}
      </div>
      <h1 className="title">{recipe.title}</h1>
      {recipe.metadata.length > 0 ? (
        <div className="meta">
          {recipe.metadata.map(([k, v], i) => (
            <span key={k}>
              {i > 0 ? <span className="sep">·&nbsp;</span> : null}
              <b>{k}</b> {v}
            </span>
          ))}
        </div>
      ) : null}
      <div className="cols">
        <aside className="panel">
          <h2 className="h2">Ingredients</h2>
          {recipe.ingredients.map((ing, i) => (
            <div className="ing" key={`${ing.name}-${i}`}>
              <span>{ing.name}</span>
              {ing.quantity ? <span className="q">{ing.quantity}</span> : null}
            </div>
          ))}
          {recipe.cookware.length > 0 ? (
            <>
              <h2 className="h2" style={{ marginTop: 20 }}>
                Cookware
              </h2>
              {recipe.cookware.map((c, i) => (
                <div className="cook" key={`${c}-${i}`}>
                  {c}
                </div>
              ))}
            </>
          ) : null}
        </aside>
        <section className="panel">
          <h2 className="h2">Method</h2>
          <ol className="steps">
            {recipe.steps.map((_, i) => (
              <li className="step" key={i}>
                <span className="num">{i + 1}</span>
                <Step recipe={recipe} index={i} />
              </li>
            ))}
          </ol>
          {recipe.logs.length > 0 ? (
            <div className="logs">
              <h2 className="h2">Cooking log</h2>
              {recipe.logs.map((l, i) => (
                <div className="log" key={i}>
                  <span className="d">{l.date}</span> — {l.note}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function RecipeCardApp() {
  const {
    data: recipe,
    fullscreen,
    requestFullscreen,
  } = useWidgetData<RecipeCardData>('chowdown-recipe-card');

  if (!recipe) {
    return (
      <div className="wrap">
        <style>{STYLES}</style>
        <div className="card">Loading recipe…</div>
      </div>
    );
  }
  return (
    <>
      <style>{STYLES}</style>
      {fullscreen ? (
        <FullRecipe recipe={recipe} />
      ) : (
        <InlineCard recipe={recipe} onView={requestFullscreen} />
      )}
    </>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<RecipeCardApp />);
}
