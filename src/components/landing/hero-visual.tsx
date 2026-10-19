import { CookFile } from '@/components/landing/cook-file-view';
import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { RenderedRecipe } from '@/components/landing/rendered-recipe';

/**
 * The hero picture: the plain text file on one side and the finished recipe it
 * becomes on the other, which shows the whole idea of the product at a glance.
 */
export function HeroVisual({ recipe }: { recipe: SampleRecipe }) {
  return (
    <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_1fr] sm:items-center sm:gap-0">
      <div className="sm:relative sm:z-10 sm:-mr-4">
        <CookFile recipe={recipe} />
      </div>
      <div className="sm:translate-y-10">
        <RenderedRecipe recipe={recipe} />
      </div>
    </div>
  );
}
