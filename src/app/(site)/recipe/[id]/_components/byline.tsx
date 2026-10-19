import Link from 'next/link';
import type { ReactElement } from 'react';

import { LinkIcon } from '@/components/icons';
import { TextLink } from '@/components/ui/text-link';
import { domainOf } from '@/lib/recipe/cook-text';

/**
 * The metadata keys that name a recipe's author, most specific first. They are
 * the same two the page's structured data reads, so the byline and the
 * `author` in the JSON-LD never disagree about who wrote the recipe.
 */
const AUTHOR_KEYS: readonly string[] = ['author', 'by'];

/** A metadata key with case, spaces, underscores and hyphens ignored ("Author", "AUTHOR"). */
function normalisedKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '');
}

/** Whether a metadata key is one that names the author (and so is shown in the byline). */
export function isAuthorKey(key: string): boolean {
  return AUTHOR_KEYS.includes(normalisedKey(key));
}

/**
 * The recipe's author from its metadata: the first non-empty value under an
 * author key, trimmed, or `undefined` when there is none. The value is
 * untrusted text from a recipe file, so it is only ever rendered as text.
 */
export function authorOf(
  metadata: readonly (readonly [name: string, value: string])[],
): string | undefined {
  return AUTHOR_KEYS.map((wanted) =>
    metadata
      .find(
        ([name, value]) =>
          normalisedKey(name) === wanted && value.trim() !== '',
      )?.[1]
      .trim(),
  ).find((value) => value !== undefined);
}

/** The recipe's origin as a link out to the original page. */
function LinkedSource({
  url,
  domain,
}: Readonly<{ url: string; domain: string }>): ReactElement {
  return (
    <>
      <span className="text-subtle">From</span>
      <TextLink
        href={url}
        external
        variant="strong"
        className="inline-flex h-8 items-center gap-1.5"
      >
        <LinkIcon size="sm" />
        {domain}
      </TextLink>
    </>
  );
}

/**
 * The author's name in a handwriting face, so it reads as a person's name
 * rather than as more interface text. "by" is the quiet word before it ("By"
 * when it opens the line). A long name is cut with an ellipsis rather than
 * pushing the line wider than a phone. The right padding is not decoration:
 * the cut-off box would otherwise clip the overhang of the last letter's stroke.
 */
function Author({
  name,
  opening,
}: Readonly<{
  name: string;
  /** Nothing precedes it on the line, so the lead word is capitalised. */
  opening: boolean;
}>): ReactElement {
  return (
    <span className="flex max-w-full min-w-0 items-baseline gap-2">
      <span className="text-subtle">{opening ? 'By' : 'by'}</span>
      <span
        title={name}
        className="font-hand text-ink min-w-0 truncate pr-1 text-2xl leading-8 font-semibold"
      >
        {name}
      </span>
    </span>
  );
}

/**
 * Where the recipe came from and who wrote it, under the title: a link out to
 * the original page, the author's name in handwriting, and a small "More from"
 * link that lists the other recipes saved from the same site. A source that is
 * not a web address (typed in by hand) is shown as plain text, and the "More
 * from" link appears only when there is a site to list. Whichever of the source
 * and author a recipe lacks is left out, and one with neither shows nothing.
 */
export function Byline({
  value,
  url,
  author,
}: Readonly<{
  /** The recipe's own "source" line, shown as plain text when there is no web address. */
  value?: string;
  /** The web address the recipe was saved from. */
  url?: string;
  /** Who wrote the recipe, as the recipe's file says (see {@link authorOf}). */
  author?: string;
}>): ReactElement | null {
  const domain = url ? domainOf(url) : undefined;
  const hasSource = Boolean(domain ?? value);
  if (!hasSource && !author) {
    return null;
  }
  return (
    <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {url && domain ? (
        <LinkedSource url={url} domain={domain} />
      ) : value ? (
        <span>
          <span className="text-subtle">From </span>
          <span className="font-semibold">{value}</span>
        </span>
      ) : null}
      {author ? <Author name={author} opening={!hasSource} /> : null}
      {domain ? (
        // Not a TextLink: this one is a small bordered button-like link, not an
        // underlined one, so it keeps its own look.
        <Link
          href={`/app?site=${encodeURIComponent(domain)}`}
          className="rounded-control border-field hover:border-ink focus-ring inline-flex h-8 items-center border px-2.5 text-xs font-medium transition print:hidden"
        >
          More from {domain}
        </Link>
      ) : null}
    </p>
  );
}
