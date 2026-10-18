import { CheckIcon, PlugIcon } from '@/design/icons';
import { DesignShell } from '@/design/shell';
import { MCP_URL } from '@/design/site-footer';
import { Button } from '@/design/ui/button';
import { CopyField } from '@/design/ui/copy-field';
import { Container, Eyebrow, Heading } from '@/design/ui/layout';

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
];

const ACCESS: [string, string][] = [
  ['Read', 'See, search and find similar recipes.'],
  ['Write', 'Add, edit, tag, favourite and annotate recipes.'],
];

const CONNECTED: { name: string; access: string; last: string }[] = [
  { name: 'ChatGPT', access: 'Read and write', last: 'Used 2 hours ago' },
  { name: 'Claude', access: 'Read only', last: 'Used 3 days ago' },
];

/** How to connect an assistant, and which ones already are. */
export default function DesignConnect() {
  return (
    <DesignShell signedIn active="connect">
      <div className="border-ink/10 border-b">
        <Container className="py-10 sm:py-14">
          <Eyebrow>Connect an assistant</Eyebrow>
          <Heading as="h1" variant="h1" className="mt-2 max-w-3xl">
            Bring your recipes into any AI assistant
          </Heading>
          <p className="text-ink/70 mt-5 max-w-2xl text-lg leading-relaxed">
            chowdown speaks MCP, the open standard assistants use to reach your
            tools. Add this address once and ask for ideas, searches and new
            recipes in plain words.
          </p>
          <div className="mt-8 max-w-2xl">
            <p className="mb-2 text-sm font-semibold">MCP server address</p>
            <CopyField value={MCP_URL} label="MCP server address" />
          </div>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-10 py-12 md:grid-cols-2">
        {ASSISTANTS.map((a) => (
          <section
            key={a.name}
            className="rounded-card border-ink/10 border bg-white p-6 sm:p-8"
          >
            <Heading variant="h3">{a.name}</Heading>
            <ol className="mt-5 flex flex-col gap-4">
              {a.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-4">
                  <span className="bg-flame text-ink grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </Container>

      <Container className="grid grid-cols-1 gap-10 pb-4 md:grid-cols-2">
        <section>
          <Heading variant="h3">What you are allowing</Heading>
          <ul className="divide-ink/10 border-ink/10 mt-5 divide-y border-y">
            {ACCESS.map(([title, body]) => (
              <li key={title} className="flex items-start gap-3 py-4">
                <CheckIcon className="text-live mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  <span className="font-semibold">{title}.</span> {body}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-ink/65 mt-4 text-sm">
            You choose at the approval screen, and you can disconnect any app
            below at any time.
          </p>
        </section>

        <section>
          <Heading variant="h3">Connected apps</Heading>
          <ul className="mt-5 flex flex-col gap-3">
            {CONNECTED.map((app) => (
              <li
                key={app.name}
                className="rounded-card border-ink/10 flex items-center justify-between gap-4 border bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-control bg-ink/5 grid h-10 w-10 place-items-center">
                    <PlugIcon className="h-5 w-5" />
                  </span>
                  <p className="leading-tight">
                    <span className="block font-semibold">{app.name}</span>
                    <span className="text-ink/65 block text-sm">
                      {app.access} · {app.last}
                    </span>
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </DesignShell>
  );
}
