import { PlusIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/layout';

/**
 * What a signed-in person with no recipes sees in place of a list: a friendly
 * nudge and the way to add the first ones. Shared by the home page and the
 * recipe list.
 */
export function EmptyCollection() {
  return (
    <div className="rounded-card border-ink/25 border border-dashed px-6 py-16 text-center">
      <Heading variant="h3">No recipes yet</Heading>
      <p className="text-ink/70 mx-auto mt-2 max-w-md">
        Paste a link, drop in a photo or a file, or save a recipe from your
        assistant, and it will show up here.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/recipes/add" size="lg">
          <PlusIcon className="h-4 w-4" />
          Add recipes
        </ButtonLink>
      </div>
    </div>
  );
}
