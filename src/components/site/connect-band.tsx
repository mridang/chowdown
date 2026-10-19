import { ArrowIcon, PlugIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { CopyField } from '@/components/ui/copy-field';
import { Container, Eyebrow, Heading } from '@/components/ui/layout';
import { MCP_URL } from '@/lib/site';

/**
 * A call to action to connect an AI assistant: a short pitch, the server
 * address with a Copy button, and a link to the full instructions. Used on the
 * home page; the footer carries a smaller version of the same address.
 */
export function ConnectBand() {
  return (
    <section className="bg-marigold">
      <Container className="grid grid-cols-1 items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <Eyebrow className="text-ink flex items-center gap-2">
            <PlugIcon size="sm" />
            Works with ChatGPT and Claude
          </Eyebrow>
          <Heading className="mt-3">Ask your assistant what to cook</Heading>
          <p className="text-muted mt-4 max-w-xl text-lg leading-relaxed">
            Add chowdown to your AI assistant with one address. It can search
            your recipes, suggest dinner from what you have saved, and file new
            ones for you.
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Your MCP server address</p>
          <CopyField value={MCP_URL} label="MCP server address" />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <ButtonLink href="/connect" size="lg">
              Set it up <ArrowIcon size="sm" />
            </ButtonLink>
            <p className="text-muted text-sm">
              You sign in and approve. No keys to copy.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
