import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { ChevronLeftIcon } from '@/components/icons';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { TextLink } from '@/components/ui/text-link';

import {
  LegalItem,
  LegalSection,
} from '@/app/(site)/privacy/_components/legal-section';

/**
 * A public page: it may be indexed, and it carries its own social card (the
 * image comes from the site-wide one).
 */
export const metadata: Metadata = pageMetadata({
  title: 'Terms',
  description:
    'The terms for using chowdown: keep your own recipes, and treat its AI help as a best guess.',
  path: '/terms',
  index: true,
});

/**
 * Terms of service, linked from the Google OAuth consent screen. Short and
 * plain, in the same layout as the privacy policy.
 */
export default function TermsPage(): ReactElement {
  return (
    <Container className="py-10 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Terms</Eyebrow>
        <Heading as="h1" variant="h1" className="mt-2">
          Terms of Service
        </Heading>
        <p className="mt-3 text-sm text-muted">Last updated: 1 November 2026</p>

        <div className="mt-8 space-y-9 text-lg leading-relaxed text-muted">
          <p>
            chowdown is a free, personal recipe keeper. It stores your recipes
            as Cooklang (<code className="font-mono text-base">.cook</code>)
            files in your own Google Drive. By using it you agree to these
            terms. If you don’t, please don’t use it.
          </p>

          <LegalSection title="Using chowdown">
            <ul className="space-y-2">
              <LegalItem>
                Use it for your own recipes. Only import or save recipes you
                have the right to keep a copy of, and don’t use chowdown to
                republish other people’s work.
              </LegalItem>
              <LegalItem>
                Don’t use chowdown to attack, overload or get around the
                protections of any site, including through the links you ask it
                to import, or to get around chowdown’s own limits.
              </LegalItem>
              <LegalItem>
                Keep your Google account secure: you are responsible for what is
                done with your chowdown account and the assistants you connect
                to it.
              </LegalItem>
            </ul>
          </LegalSection>

          <LegalSection title="Your recipes">
            <p>
              Your recipes are yours. chowdown keeps them as files in your
              Drive, and they stay there, readable by any text editor, whether
              or not you keep using chowdown.
            </p>
          </LegalSection>

          <LegalSection title="Artificial intelligence">
            <p>
              Importing a recipe, tagging it and finding similar ones are done
              by an AI model, and are a best effort. It can misread a page, get
              a quantity, time or temperature wrong, or leave something out.
              Check an imported recipe before you cook from it, especially for
              allergens and food safety.
            </p>
          </LegalSection>

          <LegalSection title="The service">
            <p>
              chowdown is provided as it is, without warranty of any kind. It
              may change, be unavailable or stop at any time, and as far as the
              law allows we are not liable for any loss from using it. We may
              remove an account that breaks these terms.
            </p>
          </LegalSection>

          <LegalSection title="Open source">
            <p>
              chowdown’s code is open source under the Apache 2.0 licence, and
              is on{' '}
              <TextLink href="https://github.com/mridang/chowdown" external>
                GitHub
              </TextLink>
              . That licence, not these terms, covers the code.
            </p>
          </LegalSection>

          <LegalSection title="Your data">
            <p>
              What chowdown keeps, and how to delete it, is in the{' '}
              <TextLink href="/privacy">privacy policy</TextLink>.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>mridang.agarwalla@gmail.com</p>
          </LegalSection>
        </div>

        <Link
          href="/"
          className="focus-ring mt-12 inline-flex h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          <ChevronLeftIcon size="sm" />
          Back to chowdown
        </Link>
      </div>
    </Container>
  );
}
