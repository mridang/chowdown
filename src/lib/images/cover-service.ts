/**
 * @packageDocumentation
 *
 * Answering one request for a cover photo: from the edge cache when it has the
 * photo, otherwise by fetching it (see `cover-proxy.ts`), keeping a copy at the
 * edge, and sending it on. The cache, the Images binding and the "run this
 * later" hook are passed in, so a test can use small fakes.
 */

import { problems } from '../api/problem';
import { replacingHeaders } from '../http/headers';
import {
  fetchCover,
  isFetchableImageUrl,
  type CoverFetch,
  type ImagesLike,
} from './cover-proxy';

/** The two cache operations the service uses. */
export type CoverCache = Pick<Cache, 'match' | 'put'>;

/** What the service reaches out to. */
export interface CoverServiceDeps {
  /** The edge cache, where the runtime has one. */
  readonly cache?: CoverCache;
  /** The Images binding, where the deployment has one. */
  readonly images?: ImagesLike;
  /** Fetch the photo from its site; the real `fetch` when left out. */
  readonly fetcher?: CoverFetch;
  /**
   * Whether the person asking may have the proxy fetch this address (see
   * `cover-ownership.ts`). Asked only when the edge has no copy, since a copy
   * costs nothing and is a public photo anyway.
   */
  readonly mayFetch: (url: string) => Promise<boolean>;
  /** Run work after the response is sent (storing the copy). */
  readonly background: (work: Promise<unknown>) => void;
}

/** The key a cover is kept under. It leaves out cookies, so everyone shares one copy. */
export function coverCacheKey(width: number, url: string): Request {
  return new Request(
    `https://covers.chowdown.invalid/${width}/${encodeURIComponent(url)}`,
  );
}

/** The same image, but kept only by the browser (the edge already has its copy). */
export function withBrowserCaching(response: Response): Response {
  return new Response(response.body, {
    status: 200,
    headers: replacingHeaders(response.headers, {
      'Cache-Control': 'private, max-age=604800, immutable',
    }),
  });
}

/**
 * The response for a request for the photo at `url`, scaled to `width`: the
 * photo (200), 400 for an address that is not a public image, 404 when the
 * person has no recipe with that photo or when the photo is gone, or 502 when
 * its site cannot be reached or refuses.
 */
export async function serveCover(
  url: string,
  width: number,
  deps: CoverServiceDeps,
): Promise<Response> {
  if (!isFetchableImageUrl(url)) {
    return problems.badRequest('url: must be a public http(s) image address.');
  }
  // The edge cache is shared across people, which is fine: the photo is public.
  const key = coverCacheKey(width, url);
  const hit = await deps.cache?.match(key);
  if (hit) {
    return withBrowserCaching(hit);
  }

  // Only photos the person's own recipes list are fetched on their behalf;
  // anything else would make the proxy a free relay for the whole web.
  if (!(await deps.mayFetch(url))) {
    return problems.notFound('cover image');
  }

  const result = await fetchCover(url, width, {
    images: deps.images,
    fetcher: deps.fetcher,
  });
  if (!result.ok) {
    return result.status === 404
      ? problems.notFound('cover image')
      : problems.upstream(result.reason);
  }
  const { cache } = deps;
  if (cache) {
    deps.background(cache.put(key, result.response.clone()));
  }
  return withBrowserCaching(result.response);
}
