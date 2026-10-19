/**
 * @packageDocumentation
 *
 * Server-side page fetching for recipe import. Shared by the app's bulk import
 * route and the MCP import tool's enrichment step, so both present the same
 * browser-ish identity and the same size/time bounds.
 *
 * Fetching arbitrary pages from a Worker can run into bot protection or
 * paywalls; callers treat a failure as "no server-side copy available" and
 * carry on with whatever content they already have.
 */

/** A browser-ish UA; some sites 403 the default fetch agent. */
const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
} as const;

/** Max characters of HTML kept, so a huge page can't blow a request up. */
const MAX_HTML = 200_000;

/**
 * Fetch a page's HTML, bounded in size and time.
 *
 * @param url - The page to fetch (http/https).
 * @param timeoutMs - Abort after this long (default 8s).
 * @throws When the request fails, times out, or returns a non-2xx status.
 */
export async function fetchPage(
  url: string,
  timeoutMs = 8000,
): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`fetch failed (${res.status})`);
  }
  return (await res.text()).slice(0, MAX_HTML);
}
