import type { ReactElement } from 'react';

import { PlusIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * What a signed-in person with no recipes sees in place of a list: a friendly
 * nudge and the way to add the first ones. Shared by the home page and the
 * recipe list.
 */
export function EmptyCollection(): ReactElement {
  return (
    <EmptyState
      title="No recipes yet"
      actions={
        <ButtonLink href="/recipes/add" size="lg">
          <PlusIcon size="sm" />
          Add recipes
        </ButtonLink>
      }
    >
      <p className="mx-auto mt-2 max-w-md text-muted">
        Paste a link, drop in a photo or a file, or save a recipe from your
        assistant, and it will show up here.
      </p>
    </EmptyState>
  );
}
