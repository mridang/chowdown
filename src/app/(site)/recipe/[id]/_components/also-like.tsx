import { RecipeCard, RecipeGrid } from '@/components/recipes/recipe-card';
import { Container, Heading } from '@/components/ui/layout';
import type { CardRecipe } from '@/lib/recipe/card-data';

/**
 * The "You might also like" row at the foot of the recipe page: similar recipes
 * as cards. Hidden when printing, and absent when there is nothing similar.
 */
export function AlsoLike({ recipes }: { recipes: CardRecipe[] }) {
  if (recipes.length === 0) {
    return null;
  }
  return (
    <Container className="mt-16 print:hidden">
      <Heading>You might also like</Heading>
      <div className="mt-6">
        <RecipeGrid columns={4}>
          {recipes.map((card) => (
            <RecipeCard key={card.id} recipe={card} />
          ))}
        </RecipeGrid>
      </div>
    </Container>
  );
}
