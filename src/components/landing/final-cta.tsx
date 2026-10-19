import type { ReactElement } from 'react';

import { SignInButton } from '@/components/landing/sign-in-button';
import { Container, Heading } from '@/components/ui/layout';

/** The closing call to action: a marigold band with one more way in. */
export function FinalCta(): ReactElement {
  return (
    <section className="bg-marigold">
      <Container className="flex flex-col items-start justify-between gap-6 py-14 sm:py-16 md:flex-row md:items-center">
        <div>
          <Heading>Start your collection today</Heading>
          <p className="text-muted mt-2 text-lg">
            Sign in with Google and add your first recipe.
          </p>
        </div>
        <SignInButton />
      </Container>
    </section>
  );
}
