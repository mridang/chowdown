import Link from 'next/link';
import type { ReactElement } from 'react';

import { LinkIcon } from '@/components/icons';
import { AuthorName } from '@/components/recipe/author-name';
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
 * Who wrote the recipe, directly under the title: a small "by" in the body
 * face and the name in handwriting, so it reads as a person's name rather than
 * as more interface text. A long name is cut with an ellipsis (see
 * {@link AuthorName}) instead of pushing the line wider than a phone, which is
 * why the line is a flex row whose name may shrink (`min-w-0`).
 */
export function AuthorLine({
  name,
}: Readonly<{
  /** Who wrote the recipe, as the recipe's file says (see {@link authorOf}). */
  name: string;
}>): ReactElement {
  return (
    <p className="mt-3 flex max-w-full min-w-0 items-baseline gap-2">
      <span className="text-subtle text-sm">by</span>
      <AuthorName name={name} size="lg" />
    </p>
  );
}

/**
 * Where the recipe came from: a link out to the original page and a small
 * "More from" link that lists the other recipes saved from the same site. A
 * source that is not a web address (typed in by hand) is shown as plain text,
 * and the "More from" link appears only when there is a site to list. It shows
 * nothing when the recipe has no source at all, so no empty gap is left.
 */
export function SourceLine({
  value,
  url,
}: Readonly<{
  /** The recipe's own "source" line, shown as plain text when there is no web address. */
  value?: string;
  /** The web address the recipe was saved from. */
  url?: string;
}>): ReactElement | null {
  const domain = url ? domainOf(url) : undefined;
  if (!domain && !value) {
    return null;
  }
  return (
    <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {url && domain ? (
        <LinkedSource url={url} domain={domain} />
      ) : (
        <span>
          <span className="text-subtle">From </span>
          <span className="font-semibold">{value}</span>
        </span>
      )}
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
