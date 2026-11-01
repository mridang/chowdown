import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { CONTACT_EMAIL, SOURCE_URL, TERMS_LAST_UPDATED } from '@/utils/site';
import { Container } from '@/components/ui/layout';

import {
  LegalCode,
  LegalItem,
  LegalLink,
  LegalPage,
  LegalSection,
} from '@/app/(site)/privacy/_components/legal-section';

/**
 * A public page: it may be indexed, and it carries its own social card (the
 * image comes from the site-wide one).
 */
export const metadata: Metadata = pageMetadata({
  title: 'Terms',
  description:
    'The terms for using Chowdown: keep your own recipes, and treat its AI help as a best guess.',
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
      <LegalPage
        eyebrow="Terms"
        title="Terms of Service"
        updated={TERMS_LAST_UPDATED}
      >
        <p>
          Chowdown is a free, personal recipe keeper. It stores your recipes as
          Cooklang (<LegalCode>.cook</LegalCode>) files in your own Google
          Drive. By using it you agree to these terms. If you don’t, please
          don’t use it.
        </p>

        <LegalSection title="Using Chowdown">
          <ul className="space-y-2">
            <LegalItem>
              Use it for your own recipes. Only import or save recipes you have
              the right to keep a copy of, and don’t use Chowdown to republish
              other people’s work.
            </LegalItem>
            <LegalItem>
              Don’t use Chowdown to attack, overload or get around the
              protections of any site, including through the links you ask it to
              import, or to get around Chowdown’s own limits.
            </LegalItem>
            <LegalItem>
              Keep your Google account secure: you are responsible for what is
              done with your Chowdown account and the assistants you connect to
              it.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="Your recipes">
          <p>
            Your recipes are yours. Chowdown keeps them as files in your Drive,
            and they stay there, readable by any text editor, whether or not you
            keep using Chowdown.
          </p>
        </LegalSection>

        <LegalSection title="Artificial intelligence">
          <p>
            Importing a recipe, tagging it and finding similar ones are done by
            an AI model, and are a best effort. It can misread a page, get a
            quantity, time or temperature wrong, or leave something out. Check
            an imported recipe before you cook from it, especially for allergens
            and food safety.
          </p>
        </LegalSection>

        <LegalSection title="The service">
          <p>
            Chowdown is provided as it is, without warranty of any kind. It may
            change, be unavailable or stop at any time, and as far as the law
            allows we are not liable for any loss from using it. We may remove
            an account that breaks these terms.
          </p>
        </LegalSection>

        <LegalSection title="Open source">
          <p>
            Chowdown’s code is open source under the Apache 2.0 licence, and is
            on <LegalLink href={SOURCE_URL}>GitHub</LegalLink>. That licence,
            not these terms, covers the code.
          </p>
        </LegalSection>

        <LegalSection title="Your data">
          <p>
            What Chowdown keeps, and how to delete it, is in the{' '}
            <LegalLink href="/privacy">privacy policy</LegalLink>.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>{CONTACT_EMAIL}</p>
        </LegalSection>
      </LegalPage>
    </Container>
  );
}
