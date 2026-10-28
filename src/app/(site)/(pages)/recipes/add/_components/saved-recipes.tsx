import type { ReactElement } from 'react';

import { RecipeCard, RecipeGrid } from '@/components/recipes/recipe-card';
import type { CardRecipe } from '@/domain/recipe/card-data';

/**
 * The recipes the person just saved, as the same cards the collection shows,
 * so they can see what landed in their Drive and open any of them.
 */
export function SavedRecipes({
  recipes,
}: Readonly<{ recipes: readonly CardRecipe[] }>): ReactElement | null {
  if (recipes.length === 0) {
    return null;
  }
  return (
    <div className="mt-6">
      <RecipeGrid>
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} live />
        ))}
      </RecipeGrid>
    </div>
  );
}
