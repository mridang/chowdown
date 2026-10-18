'use client';

import { BarePage, Notice } from '@/components/landing/bare-page';
import { Button, ButtonLink } from '@/components/ui/button';

/**
 * The page shown when something breaks while a page is being built or run.
 * "Try again" asks Next to re-render the page, which clears a passing hiccup;
 * the link goes home for anything that does not. The digest is the reference
 * to quote when looking the failure up in the server logs.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <BarePage>
      <Notice
        eyebrow="Something went wrong"
        title="That didn't work"
        actions={
          <>
            <Button size="lg" onClick={() => unstable_retry()}>
              Try again
            </Button>
            <ButtonLink href="/" variant="outline" size="lg">
              Back to the home page
            </ButtonLink>
          </>
        }
      >
        <p>
          Something went wrong on our side. Try again in a moment, and your
          recipes will still be in your Drive either way.
        </p>
        {error.digest ? (
          <p className="text-ink/65 mt-3 font-mono text-sm">
            Reference: {error.digest}
          </p>
        ) : null}
      </Notice>
    </BarePage>
  );
}
