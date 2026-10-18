/**
 * Cover photos, served from our own address (see `lib/images/cover-proxy.ts`
 * for why).
 *
 *   GET /api/cover-images?url=<photo address>&w=<width>
 *
 * Only signed-in people may use it, so it can't become a free image proxy for
 * the web. Answers come from the edge cache when they can.
 */

import { getSessionUid } from '@/lib/auth/current-user';
import { problems } from '@/lib/api/problem';
import {
  fetchCover,
  isFetchableImageUrl,
  snapWidth,
} from '@/lib/images/cover-proxy';
import { runInBackground } from '@/lib/util';

/** Cloudflare's per-colo cache; absent when running under plain Node. */
function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

export async function GET(request: Request): Promise<Response> {
  if ((await getSessionUid()) === null) {
    return problems.unauthorized();
  }
  const params = new URL(request.url).searchParams;
  const url = params.get('url') ?? '';
  const width = snapWidth(Number(params.get('w')) || 640);
  if (!isFetchableImageUrl(url)) {
    return problems.badRequest('url: must be a public http(s) image address.');
  }

  // The edge cache is shared across people, which is fine: the photo is public.
  // Its key leaves out cookies, so everyone who opens a recipe warms it for
  // everyone.
  const cache = edgeCache();
  const key = new Request(
    `https://covers.chowdown.invalid/${width}/${encodeURIComponent(url)}`,
  );
  const hit = await cache?.match(key);
  if (hit) {
    return withBrowserCaching(hit);
  }

  const result = await fetchCover(url, width);
  if (!result.ok) {
    return result.status === 404
      ? problems.notFound('cover image')
      : problems.upstream(result.reason);
  }
  if (cache) {
    runInBackground(cache.put(key, result.response.clone()));
  }
  return withBrowserCaching(result.response);
}

/** The same image, but kept only by the browser (the edge already has its copy). */
function withBrowserCaching(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, max-age=604800, immutable');
  return new Response(response.body, { status: 200, headers });
}
