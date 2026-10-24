/**
 * @packageDocumentation
 *
 * Server-side page fetching for recipe import. Shared by the app's bulk import
 * route and the MCP import tool's enrichment step, so both present the same
 * identity and the same address, size and time bounds (see
 * `http/safe-fetch.ts`, which does the fetching).
 *
 * Fetching arbitrary pages from a Worker can run into bot protection or
 * paywalls; callers treat a failure as "no server-side copy available" and
 * carry on with whatever content they already have.
 */

import { fetchCapped, type FetchFailure } from '@/lib/safe-fetch';

/** Max characters of HTML kept, so a huge page can't blow a request up. */
const MAX_HTML = 200_000;

/**
 * Max bytes read from the network. Four bytes a character is the most UTF-8
 * needs, so this is enough for {@link MAX_HTML} characters of any script
 * without reading far more than we will keep.
 */
const MAX_PAGE_BYTES = MAX_HTML * 4;

/** The media types that are a web page (or plain text); a site that does not say is given the benefit of the doubt. */
const PAGE_TYPES: ReadonlySet<string> = new Set([
  '',
  'text/html',
  'application/xhtml+xml',
  'text/plain',
]);

/** The ways fetching a page fails, in the fixed words import shows people. */
export type PageFailure =
  | 'blocked'
  | 'timed out'
  | 'not a web page'
  | 'unreachable'
  | `fetch failed (${number})`;

/** A page that could not be fetched, and which way it failed. */
export class PageFetchError extends Error {
  override readonly name = 'PageFetchError';

  /** @param failure Which way it failed, in words that are safe to show. */
  constructor(readonly failure: PageFailure) {
    super(failure);
  }
}

/** The fixed words for a failed fetch. */
function describe(failure: FetchFailure): PageFailure {
  switch (failure.reason) {
    case 'blocked':
    case 'redirects':
      return 'blocked';
    case 'timeout':
      return 'timed out';
    case 'type':
      return 'not a web page';
    case 'status':
      return `fetch failed (${failure.status})`;
    case 'unreachable':
    case 'too-large':
      return 'unreachable';
  }
}

/**
 * Fetch a page's HTML, bounded in address, size and time. A page longer than
 * the limit is cut off rather than refused: the recipe is usually near the
 * top.
 *
 * @param url - The page to fetch (a public http/https address).
 * @param timeoutMs - Abort after this long (default 8s).
 * @throws {PageFetchError} When the address is not allowed, the site does not
 * answer in time, answers with a non-2xx status, or sends something that is
 * not a page.
 */
export async function fetchPage(
  url: string,
  timeoutMs = 8000,
): Promise<string> {
  const result = await fetchCapped(url, {
    maxBytes: MAX_PAGE_BYTES,
    timeoutMs,
    accept: 'text/html,application/xhtml+xml',
    acceptsType: (type) => PAGE_TYPES.has(type),
    overflow: 'truncate',
  });
  if (!result.ok) {
    throw new PageFetchError(describe(result));
  }
  return new TextDecoder().decode(result.bytes).slice(0, MAX_HTML);
}
