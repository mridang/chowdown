import type { Metadata } from 'next';
import Link from 'next/link';

import { ChevronLeftIcon } from '@/components/icons';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';

export const metadata: Metadata = {
  title: 'Privacy — chowdown',
  robots: { index: true, follow: true },
};

/** A list item with a flame-coloured marker, so lists read as part of the brand. */
function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="bg-flame mt-[0.65rem] h-1.5 w-1.5 shrink-0 rounded-full"
      />
      <span>{children}</span>
    </li>
  );
}

/** A titled block of the policy. */
function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Heading variant="h3">{title}</Heading>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Privacy policy. Required for the Google OAuth consent screen / production
 * publishing, and a plain statement of exactly what chowdown touches. Kept
 * deliberately short and concrete.
 */
export default function PrivacyPage() {
  return (
    <Container className="py-10 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Privacy</Eyebrow>
        <Heading as="h1" variant="h1" className="mt-2">
          Privacy Policy
        </Heading>
        <p className="text-ink/70 mt-3 text-sm">
          Last updated: 11 October 2026
        </p>

        <div className="text-ink/85 mt-8 space-y-9 text-lg leading-relaxed">
          <p>
            chowdown is a personal recipe app. It stores your recipes as
            Cooklang (<code className="font-mono text-base">.cook</code>) files
            in your own Google Drive. This policy explains what it accesses and
            keeps.
          </p>

          <Block title="What we access">
            <ul className="space-y-2">
              <Item>
                Your Google account’s basic identity (name, email, profile
                picture) — to sign you in.
              </Item>
              <Item>
                Google Drive, using the{' '}
                <code className="font-mono text-base">drive.file</code> scope
                only. This grants access{' '}
                <strong>
                  solely to the recipe files chowdown itself creates
                </strong>{' '}
                in a “Recipes” folder — never the rest of your Drive.
              </Item>
            </ul>
          </Block>

          <Block title="What we store">
            <ul className="space-y-2">
              <Item>Your name, email and Google account id.</Item>
              <Item>
                A Google refresh token, <strong>encrypted at rest</strong>, so
                the app can sync your recipes when you’re away.
              </Item>
              <Item>
                A cached copy of your recipe files, to make the app and your MCP
                link fast. Your Drive remains the source of truth.
              </Item>
            </ul>
          </Block>

          <Block title="What we don’t do">
            <p>
              We don’t sell or share your data, show ads, or access anything in
              your Drive beyond the recipe files the app created. Your recipe
              data is never used to train any model.
            </p>
          </Block>

          <Block title="Deleting your data">
            <p>
              Remove chowdown’s access at{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-ember hover:text-ink underline underline-offset-4"
              >
                your Google account permissions
              </a>
              , and email us to delete your stored record. Your{' '}
              <code className="font-mono text-base">.cook</code> files always
              remain yours in your Drive.
            </p>
          </Block>

          <Block title="Contact">
            <p>mridang.agarwalla@gmail.com</p>
          </Block>
        </div>

        <Link
          href="/"
          className="text-ink/75 hover:text-ink focus-visible:outline-ink mt-12 inline-flex h-10 items-center gap-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to chowdown
        </Link>
      </div>
    </Container>
  );
}
