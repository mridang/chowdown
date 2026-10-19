import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { ChevronLeftIcon } from '@/components/icons';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { TextLink } from '@/components/ui/text-link';

import { LegalItem, LegalSection } from './_components/legal-section';

/** The picture shown when the page is shared; the same card as the rest of the site. */
const SOCIAL_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  alt: 'chowdown: your recipes, kept as plain text in your own Google Drive',
};
/** The tab title, and the title of the social card. */
const PRIVACY_TITLE = 'Privacy · chowdown';
/** What search results and social cards say about the page. */
const PRIVACY_DESCRIPTION =
  'What chowdown stores, what it asks Google for, and what stays in your own Drive.';

/**
 * A public page: it may be indexed, and it carries its own social card (the
 * image comes from the site-wide one).
 */
export const metadata: Metadata = {
  title: PRIVACY_TITLE,
  description: PRIVACY_DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'website',
    siteName: 'chowdown',
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    url: '/privacy',
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

/**
 * Privacy policy. Required for the Google OAuth consent screen / production
 * publishing, and a plain statement of exactly what chowdown touches. Kept
 * deliberately short and concrete.
 */
export default function PrivacyPage(): ReactElement {
  return (
    <Container className="py-10 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Privacy</Eyebrow>
        <Heading as="h1" variant="h1" className="mt-2">
          Privacy Policy
        </Heading>
        <p className="text-muted mt-3 text-sm">Last updated: 18 October 2026</p>

        <div className="text-muted mt-8 space-y-9 text-lg leading-relaxed">
          <p>
            chowdown is a personal recipe app. It stores your recipes as
            Cooklang (<code className="font-mono text-base">.cook</code>) files
            in your own Google Drive. This policy explains what it accesses and
            keeps.
          </p>

          <LegalSection title="What we access">
            <ul className="space-y-2">
              <LegalItem>
                Your Google account’s basic identity (name, email, profile
                picture) — to sign you in. This is all signing in asks for.
              </LegalItem>
              <LegalItem>
                Only if you choose to connect it, as a separate step after
                signing in: Google Drive, using the{' '}
                <code className="font-mono text-base">drive.file</code> scope
                only. This grants access{' '}
                <strong>
                  solely to the recipe files chowdown itself creates
                </strong>{' '}
                in a “Recipes” folder — never the rest of your Drive.
              </LegalItem>
            </ul>
          </LegalSection>

          <LegalSection title="What we store">
            <ul className="space-y-2">
              <LegalItem>Your name, email and Google account id.</LegalItem>
              <LegalItem>
                Once you connect Google Drive, a Google refresh token,{' '}
                <strong>encrypted at rest</strong>, so the app can sync your
                recipes when you’re away.
              </LegalItem>
              <LegalItem>
                A cached copy of your recipe files, to make the app and your MCP
                link fast. Your Drive remains the source of truth.
              </LegalItem>
            </ul>
          </LegalSection>

          <LegalSection title="What we don’t do">
            <p>
              We don’t sell or share your data, show ads, or access anything in
              your Drive beyond the recipe files the app created. Your recipe
              data is never used to train any model.
            </p>
          </LegalSection>

          <LegalSection title="Deleting your data">
            <p>
              Remove chowdown’s access at{' '}
              <TextLink
                href="https://myaccount.google.com/permissions"
                external
              >
                your Google account permissions
              </TextLink>
              , and email us to delete your stored record. Your{' '}
              <code className="font-mono text-base">.cook</code> files always
              remain yours in your Drive.
            </p>
          </LegalSection>

          <LegalSection title="Contact">
            <p>mridang.agarwalla@gmail.com</p>
          </LegalSection>
        </div>

        <Link
          href="/"
          className="text-muted hover:text-ink mt-12 inline-flex h-10 items-center gap-1 text-sm font-semibold focus-ring"
        >
          <ChevronLeftIcon size="sm" />
          Back to chowdown
        </Link>
      </div>
    </Container>
  );
}
