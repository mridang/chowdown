import type { ReactElement } from 'react';

import { CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Eyebrow, Heading } from '@/components/ui/layout';
import { SCOPE_WRITE } from '@/lib/oauth/scopes';
import {
  NEUTRAL_CLIENT_NAME,
  describeScopes,
  sanitiseDisplayName,
  type ClientIdentity,
  type RedirectDescription,
} from '@/lib/oauth/display';

/** One hidden form field carrying part of the authorization request through to the decision. */
export interface HiddenField {
  readonly name: string;
  readonly value: string;
}

/**
 * Who the client is, as far as we can tell: a verified domain is shown as the
 * site that published the app's details; anything else is plainly labelled as
 * unverified, because the name above it is only what the app calls itself.
 */
function IdentityLine({
  identity,
}: Readonly<{ identity: ClientIdentity }>): ReactElement {
  return identity.kind === 'domain' ? (
    <p className="text-muted mt-3">
      Published by <span className="font-semibold">{identity.domain}</span>.
      Check that this is the site you expect.
    </p>
  ) : (
    <p className="text-muted mt-3">
      <span className="font-semibold">Unverified app.</span> It registered
      itself without any check, so the name above is only what it calls itself.
    </p>
  );
}

/**
 * How much to allow, offered only when the app asked to change recipes: the
 * person may approve it as read-only instead. Editing is the default so an app
 * that needs it keeps working, and the choice is posted as the `access` field,
 * which `/oauth/consent` narrows the grant by.
 */
function AccessChoice(): ReactElement {
  return (
    <fieldset className="mb-6">
      <legend className="text-sm font-semibold">How much to allow</legend>
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="access"
            value="write"
            defaultChecked
            className="focus-ring mt-1"
          />
          <span className="leading-relaxed">
            <span className="font-medium">Everything it asked for</span>, as
            listed above
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="access"
            value="read"
            className="focus-ring mt-1"
          />
          <span className="leading-relaxed">
            <span className="font-medium">Read only</span>: see and search
            recipes, but change nothing
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/**
 * The approval screen's content: who is asking (their name, which they chose
 * themselves, next to the domain they are published on, which they cannot
 * fake), what they may do, and exactly where approving sends the person,
 * with a warning when that is their own computer, a private network or an
 * installed app, and a choice to allow read-only access when the app asked to
 * change recipes.
 *
 * The client's name is cleaned again here (it may have been saved before the
 * current rules) and is only ever rendered as text. The form posts the original
 * request to `/oauth/consent`, which re-checks everything.
 */
export function ConsentCard({
  clientName,
  identity,
  redirect,
  scopes,
  email,
  fields,
}: Readonly<{
  clientName: string;
  identity: ClientIdentity;
  redirect: RedirectDescription;
  scopes: readonly string[];
  email: string;
  fields: readonly HiddenField[];
}>): ReactElement {
  const name = sanitiseDisplayName(clientName, NEUTRAL_CLIENT_NAME);
  return (
    <>
      <Eyebrow>Connect an app</Eyebrow>
      <Heading as="h1" variant="h3" className="mt-2 break-words">
        Connect <span className="text-ember">{name}</span> to chowdown?
      </Heading>
      <IdentityLine identity={identity} />
      <p className="text-muted mt-3">
        Signed in as <span className="font-medium">{email}</span>. This app will
        be able to:
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {describeScopes(scopes).map((text) => (
          <li key={text} className="flex items-start gap-3">
            <CheckIcon size="md" className="text-forest mt-0.5 shrink-0" />
            <span className="leading-relaxed">{text}</span>
          </li>
        ))}
      </ul>
      <Callout className="mt-5">
        After you approve, you&apos;ll be sent back to{' '}
        <span className="block text-base font-semibold break-all">
          {redirect.short}
        </span>
        <code className="block break-all">{redirect.address}</code>
        <span className="mt-1 block">
          Only approve apps you trust. You can disconnect it any time from
          chowdown.
        </span>
      </Callout>
      {redirect.warning ? (
        <Callout tone="highlight" className="mt-3">
          <span className="font-semibold">Be careful.</span> {redirect.warning}
        </Callout>
      ) : null}
      {redirect.note ? (
        <Callout className="mt-3">{redirect.note}</Callout>
      ) : null}
      <form
        action="/oauth/consent"
        method="post"
        aria-label={`Approve or cancel connecting ${name}`}
        className="mt-6"
      >
        {scopes.includes(SCOPE_WRITE) ? <AccessChoice /> : null}
        {fields.map((field) => (
          <input
            key={field.name}
            type="hidden"
            name={field.name}
            value={field.value}
          />
        ))}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="outline"
            size="lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            name="decision"
            value="approve"
            variant="primary"
            size="lg"
          >
            Approve
          </Button>
        </div>
      </form>
    </>
  );
}
