import type { Metadata } from 'next';

import { BarePage, MessagePage } from '@/components/landing/bare-page';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found · chowdown',
  robots: { index: false },
};

/**
 * What anyone sees for an address that leads nowhere (and for a recipe that
 * does not exist): a plain explanation and two ways back.
 */
export default function NotFound() {
  return (
    <BarePage>
      <MessagePage
        eyebrow="Page not found"
        title="We couldn't find that page"
        actions={
          <>
            <ButtonLink href="/" size="lg">
              Back to the home page
            </ButtonLink>
            <ButtonLink href="/app" variant="outline" size="lg">
              Browse recipes
            </ButtonLink>
          </>
        }
      >
        <p>
          The link may be out of date, or the recipe may have been moved or
          deleted.
        </p>
      </MessagePage>
    </BarePage>
  );
}
