import type { Metadata } from 'next';

import type { ReactElement } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';

/** The tab title for the not-found page. */
export const metadata: Metadata = { title: 'Recipe not found · chowdown' };

/**
 * Shown when a recipe link points at nothing: the recipe was deleted, moved out
 * of the Recipes folder, or the address was mistyped. Offers the way back to the
 * list rather than leaving a dead end.
 */
export default function RecipeNotFound(): ReactElement {
  return (
    <Container className="py-20 sm:py-28">
      <Eyebrow>Recipe not found</Eyebrow>
      <Heading as="h1" variant="h1" className="mt-3 max-w-2xl">
        We couldn&apos;t find that recipe
      </Heading>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
        It may have been deleted, or moved out of your Recipes folder in Google
        Drive. The rest of your recipes are right where you left them.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/app" size="lg">
          Back to your recipes
        </ButtonLink>
        <ButtonLink href="/recipes/add" size="lg" variant="outline">
          Add a recipe
        </ButtonLink>
      </div>
    </Container>
  );
}
