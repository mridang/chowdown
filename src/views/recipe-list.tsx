/**
 * @packageDocumentation
 *
 * Entry point of the recipe list View: the file `scripts/build-views.mjs`
 * bundles into the list's HTML. It only mounts {@link RecipeListApp}; the View
 * itself is in `recipe-list-view.tsx`, which can be imported (and tested)
 * without a document.
 */

import { createRoot } from 'react-dom/client';

import { RecipeListApp } from './recipe-list-view';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<RecipeListApp />);
}
