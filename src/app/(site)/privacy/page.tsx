import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from '@/utils/site';
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
  title: 'Privacy',
  description:
    'What Chowdown stores, what it asks Google for, and what stays in your own Drive.',
  path: '/privacy',
  index: true,
});

/**
 * Privacy policy. Required for the Google OAuth consent screen / production
 * publishing, and a plain statement of exactly what chowdown touches. Kept
 * deliberately short and concrete.
 */
export default function PrivacyPage(): ReactElement {
  return (
    <Container className="py-10 sm:py-16">
      <LegalPage
        eyebrow="Privacy"
        title="Privacy Policy"
        updated={PRIVACY_LAST_UPDATED}
      >
        <p>
          Chowdown is a personal recipe app. It stores your recipes as Cooklang
          (<LegalCode>.cook</LegalCode>) files in your own Google Drive. This
          policy explains what it accesses and keeps.
        </p>

        <LegalSection title="What we access">
          <ul className="space-y-2">
            <LegalItem>
              Your Google account’s basic identity (name, email, profile
              picture) — to sign you in. This is all signing in asks for.
            </LegalItem>
            <LegalItem>
              Only if you choose to connect it, as a separate step after signing
              in: Google Drive, using the <LegalCode>drive.file</LegalCode>{' '}
              scope only. This grants access{' '}
              <strong>
                solely to the recipe files Chowdown itself creates
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
            <LegalItem>
              For finding similar recipes, an <strong>embedding</strong> of each
              recipe: a list of numbers that stands for what it is about, made
              from its text. It cannot be read back as a recipe.
            </LegalItem>
            <LegalItem>
              Your favourites, and the drafts of any import you have started but
              not finished.
            </LegalItem>
            <LegalItem>
              For each assistant you have connected (see below): its name, what
              you allowed it to do, when you approved it and when it last used
              the connection. We keep sign-in tokens for it only as one-way
              hashes.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="Artificial intelligence">
          <p>
            When you import a recipe, or ask Chowdown to tag one, the recipe
            text is sent to Cloudflare Workers AI, which runs the model on
            Cloudflare’s network. It turns pasted text into Cooklang, picks
            tags, and makes the embeddings above. The text is sent only for that
            job and the result is stored with your recipe. Chowdown does not use
            your recipes to train any model.
          </p>
        </LegalSection>

        <LegalSection title="Links you paste">
          <p>
            When you import a link, Chowdown’s server fetches that page (and the
            recipe’s picture) for you, so the site you linked to sees a request
            from Chowdown rather than from your browser. Pictures in your
            recipes are loaded the same way. Only web addresses that point to
            the public internet are fetched.
          </p>
        </LegalSection>

        <LegalSection title="Connected assistants">
          <p>
            If you connect an AI assistant to your recipes, you approve it on a
            consent screen first, and choose whether it may only read them or
            change them as well. What an assistant does with your recipes once
            you have allowed it is governed by that assistant’s own privacy
            policy. You can see every assistant you have connected, and
            disconnect any of them, from the Connect page; disconnecting ends
            its access immediately.
          </p>
        </LegalSection>

        <LegalSection title="Cookies and logs">
          <ul className="space-y-2">
            <LegalItem>
              One cookie, <LegalCode>chowdown_session</LegalCode>, keeps you
              signed in. It is only readable by our server, is sent only to this
              site, and lasts up to 30 days or until you sign out. Two
              short-lived cookies (ten minutes) are used while you sign in, to
              check that the answer came from the sign-in you started, and to
              bring you back to the right page.
            </LegalItem>
            <LegalItem>
              No advertising or analytics cookies, and no trackers.
            </LegalItem>
            <LegalItem>
              Cloudflare, which hosts Chowdown, records each request (the
              address it came from, the page asked for, the time and the result)
              in logs that we use to keep the service running and secure. They
              are kept for a short time and are not used to profile you.
            </LegalItem>
          </ul>
        </LegalSection>

        <LegalSection title="What we don’t do">
          <p>
            We don’t sell or share your data, show ads, or access anything in
            your Drive beyond the recipe files the app created. Your recipe data
            is never used to train any model.
          </p>
        </LegalSection>

        <LegalSection title="Deleting your data">
          <p>
            You can delete your account yourself: sign in, open the account menu
            and choose <strong>Delete account</strong>. That removes everything
            described above from Chowdown (your sign-in record, the saved copy
            of your recipes, embeddings, favourites, connected assistants and
            drafts) and signs you out. Your <LegalCode>.cook</LegalCode> files
            always remain yours in your Drive, and are not touched. To also
            withdraw Google’s permission, remove Chowdown at{' '}
            <LegalLink href="https://myaccount.google.com/permissions">
              your Google account permissions
            </LegalLink>
            . If you can’t sign in, email us and we will do it for you.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>{CONTACT_EMAIL}</p>
        </LegalSection>
      </LegalPage>
    </Container>
  );
}
