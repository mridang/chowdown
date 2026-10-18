import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { DriveConnectNotice } from '@/components/site/drive-connect';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isDriveConnected, wasDriveConnected } from '@/lib/auth/drive-access';
import { mcpUrl } from '@/lib/connected-apps';
import { appOriginFromHeaders } from '@/lib/util';
import { CopyField } from '@/components/ui/copy-field';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';

import { ConnectedApps } from './_components/connected-apps';

export const metadata: Metadata = {
  title: 'Cook with AI · chowdown',
  description:
    'Connect ChatGPT, Claude or any assistant that supports MCP to your recipes.',
};

/** Where to add the address, for each assistant, in the order a person does it. */
const ASSISTANTS: { name: string; steps: string[] }[] = [
  {
    name: 'ChatGPT',
    steps: [
      'Open Settings, then Connectors, and choose to add a custom connector.',
      'Paste the address above and name it chowdown.',
      'Sign in with Google when asked, then approve access.',
    ],
  },
  {
    name: 'Claude',
    steps: [
      'Open Settings, then Connectors, and choose Add custom connector.',
      'Paste the address above.',
      'Connect, sign in with Google, and approve access.',
    ],
  },
  {
    name: 'Any other assistant',
    steps: [
      'Find where it lets you add an MCP server or connector.',
      'Paste the address above.',
      'Sign in with Google when asked, then approve access.',
    ],
  },
];

/** What each level of access lets an assistant do (the wording of the approval screen). */
const ACCESS: [string, string][] = [
  ['Read', 'See your recipes, search them and find similar ones.'],
  [
    'Write',
    'Add, edit, tag, favourite and annotate recipes, and change your settings.',
  ],
];

/**
 * "Cook with AI": how to connect an assistant, what it is allowed to do, which
 * assistants are connected (with a way to disconnect them). Someone who hasn't connected Google Drive yet is told,
 * since an assistant has no recipes to reach until they do. Only for signed-in people; anyone else is sent to sign
 * in and brought straight back here. The addresses use the origin the page is
 * served from, so they are right in every environment.
 */
export default async function ConnectPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/api/auth/login?returnTo=${encodeURIComponent('/connect')}`);
  }
  const origin = appOriginFromHeaders(await headers());

  return (
    <>
      {isDriveConnected(user) ? null : (
        <Container className="pt-8">
          <DriveConnectNotice
            reconnect={wasDriveConnected(user)}
            returnTo="/connect"
            message="An assistant has no recipes to reach until your Drive is connected."
          />
        </Container>
      )}
      <div className="border-ink/10 border-b">
        <Container className="py-10 sm:py-14">
          <Eyebrow>Connect an assistant</Eyebrow>
          <Heading as="h1" variant="h1" className="mt-2 max-w-3xl">
            Cook with AI
          </Heading>
          <p className="text-ink/75 mt-5 max-w-2xl text-lg leading-relaxed">
            chowdown speaks MCP, the open standard assistants use to reach your
            tools. Add this address once and ask for ideas, searches and new
            recipes in plain words.
          </p>
          <div className="mt-8 max-w-2xl">
            <p className="mb-2 text-sm font-semibold">MCP server address</p>
            <CopyField value={mcpUrl(origin)} label="MCP server address" />
          </div>
        </Container>
      </div>

      <Container className="py-12">
        <h2 className="sr-only">Add it to your assistant</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {ASSISTANTS.map((a) => (
            <section
              key={a.name}
              className="rounded-card border-ink/10 border bg-white p-6 sm:p-8"
            >
              <Heading as="h3" variant="h3">
                {a.name}
              </Heading>
              <ol className="mt-5 flex flex-col gap-4">
                {a.steps.map((step, i) => (
                  <li key={step} className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="bg-flame text-ink grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold"
                    >
                      {i + 1}
                    </span>
                    <p className="pt-0.5 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </Container>

      <Container className="grid grid-cols-1 gap-12 pb-4 md:grid-cols-2 md:gap-10">
        <section>
          <Heading variant="h3">What you are allowing</Heading>
          <dl className="divide-ink/10 border-ink/10 mt-5 divide-y border-y">
            {ACCESS.map(([title, body]) => (
              <div key={title} className="py-4">
                <dt className="font-semibold">{title}</dt>
                <dd className="text-ink/75 mt-1">{body}</dd>
              </div>
            ))}
          </dl>
          <p className="text-ink/65 mt-4 text-sm">
            You approve each assistant&apos;s access when it connects, and you
            can disconnect any of them from the list at any time.
          </p>
        </section>

        <section>
          <Heading variant="h3">Connected apps</Heading>
          <ConnectedApps />
        </section>
      </Container>
    </>
  );
}
