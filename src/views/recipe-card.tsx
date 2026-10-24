/**
 * @packageDocumentation
 *
 * Entry point of the recipe card View: the file `scripts/build-views.mjs`
 * bundles into the card's HTML. It only mounts {@link RecipeCardApp}; the View
 * itself is in `recipe-card-view.tsx`, which can be imported (and tested)
 * without a document.
 */

import { createRoot } from 'react-dom/client';

import { RecipeCardApp } from '@/views/recipe-card-view';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<RecipeCardApp />);
}
