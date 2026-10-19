import Link from 'next/link';

import { LinkIcon } from '@/components/icons';
import { TextLink } from '@/components/ui/text-link';
import { domainOf } from '@/lib/recipe/cook-text';

/**
 * Where the recipe came from: a link out to the original page with a small
 * "More from" link that lists the other recipes saved from that site. A source
 * that isn't a web address (typed in by hand) is shown as plain text, and a
 * recipe with neither shows nothing.
 */
export function SourceLine({ value, url }: { value?: string; url?: string }) {
  const domain = url ? domainOf(url) : undefined;
  if (url && domain) {
    return (
      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-subtle">From</span>
        <TextLink
          href={url}
          external
          look="strong"
          className="inline-flex h-8 items-center gap-1.5"
        >
          <LinkIcon size="sm" />
          {domain}
        </TextLink>
        {/*
          Not a TextLink: this one is a small bordered button-like link, not an
          underlined one, so it keeps its own look.
        */}
        <Link
          href={`/app?site=${encodeURIComponent(domain)}`}
          className="rounded-control border-ink/25 hover:border-ink focus-ring inline-flex h-8 items-center border px-2.5 text-xs font-medium transition print:hidden"
        >
          More from {domain}
        </Link>
      </p>
    );
  }
  if (value) {
    return (
      <p className="mt-5 text-sm">
        <span className="text-subtle">From </span>
        <span className="font-semibold">{value}</span>
      </p>
    );
  }
  return null;
}
