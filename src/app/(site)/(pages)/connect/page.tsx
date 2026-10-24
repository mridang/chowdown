import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { DriveConnectNotice } from '@/components/site/drive-connect';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isDriveConnected, wasDriveConnected } from '@/lib/auth/drive-access';
import { mcpUrl } from '@/lib/connected-apps';
import { appOriginFromHeaders } from '@/utils/origin';
import { Card } from '@/components/ui/card';
import { CopyField } from '@/components/ui/copy-field';
import { Container, Heading } from '@/components/ui/layout';
import { NumberBadge } from '@/components/ui/number-badge';
import { PageHeader } from '@/components/ui/page-header';

import { ConnectedApps } from '@/app/(site)/(pages)/connect/_components/connected-apps';

/** The tab title and description of the Cook with AI page. */
export const metadata: Metadata = {
  title: 'Cook with AI',
  description:
    'Connect ChatGPT, Claude or any assistant that supports MCP to your recipes.',
};

/** Where to add the address, for each assistant, in the order a person does it. */
const ASSISTANTS: readonly Readonly<{
  name: string;
  steps: readonly string[];
}>[] = [
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
const ACCESS = [
  {
    title: 'Read',
    body: 'See your recipes, search them and find similar ones.',
  },
  {
    title: 'Write',
    body: 'Add, edit, tag, favourite and annotate recipes, and change your settings.',
  },
] as const;

/**
 * "Cook with AI": how to connect an assistant, what it is allowed to do, which
 * assistants are connected (with a way to disconnect them). Someone who hasn't
 * connected Google Drive yet is told, since an assistant has no recipes to
 * reach until they do. Only for signed-in people; anyone else is sent to sign
 * in and brought straight back here. The addresses use the origin the page is
 * served from, so they are right in every environment.
 */
export default async function ConnectPage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent('/connect')}`);
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
      <PageHeader
        roomy
        eyebrow="Connect an assistant"
        title="Cook with AI"
        intro="chowdown speaks MCP, the open standard assistants use to reach your tools. Add this address once and ask for ideas, searches and new recipes in plain words."
      >
        <div className="mt-8 max-w-2xl">
          <p className="mb-2 text-sm font-semibold">MCP server address</p>
          <CopyField value={mcpUrl(origin)} label="MCP server address" />
        </div>
      </PageHeader>

      <Container className="py-12">
        <h2 className="sr-only">Add it to your assistant</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {ASSISTANTS.map((a) => (
            <Card as="section" key={a.name} padding="lg">
              <Heading as="h3" variant="h3">
                {a.name}
              </Heading>
              <ol className="mt-5 flex flex-col gap-4">
                {a.steps.map((step, i) => (
                  <li key={step} className="flex items-start gap-4">
                    <NumberBadge value={i + 1} />
                    <p className="pt-0.5 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </Container>

      <Container className="grid grid-cols-1 gap-12 pb-4 md:grid-cols-2 md:gap-10">
        <section>
          <Heading variant="h3">What you are allowing</Heading>
          <dl className="mt-5 divide-y divide-line border-y border-line">
            {ACCESS.map(({ title, body }) => (
              <div key={title} className="py-4">
                <dt className="font-semibold">{title}</dt>
                <dd className="mt-1 text-muted">{body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-subtle">
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
