/**
 * The chowdown recipe list — an MCP Apps View rendered when list_recipes or
 * search_recipes runs. Shows the user's recipes as a tappable grid; tapping a
 * recipe asks the host to open it (a follow-up turn that fires get_recipe,
 * which renders the recipe card). Data/actions via the shared bridge.
 */

import { createRoot } from 'react-dom/client';

import type { RecipeListData } from '../lib/mcp/ui-types';
import { STYLES } from './styles';
import { useWidgetData } from './use-widget-data';

function RecipeListApp() {
  const { data, sendFollowUp } = useWidgetData<RecipeListData>(
    'chowdown-recipe-list',
  );

  if (!data) {
    return (
      <div className="wrap">
        <style>{STYLES}</style>
        <div className="card">Loading recipes…</div>
      </div>
    );
  }

  const { recipes, query } = data;

  return (
    <div className="wrap">
      <style>{STYLES}</style>
      <div className="list-head">
        <h1>{query ? `Recipes matching “${query}”` : 'Your recipes'}</h1>
        <span className="count">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      {recipes.length === 0 ? (
        <div className="empty">
          {query ? 'No recipes matched.' : 'No recipes yet.'}
        </div>
      ) : (
        <div className="grid">
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              className="tile"
              onClick={() => sendFollowUp(`Open the "${r.title}" recipe`)}
            >
              <span className="name">{r.title}</span>
              {r.uncurated ? (
                <span className="badge">idea</span>
              ) : (
                <span className="arrow" aria-hidden="true">
                  ›
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<RecipeListApp />);
}
