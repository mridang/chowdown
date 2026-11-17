/**
 * @packageDocumentation
 *
 * The server side of the image proxy: the {@link ImageService} that serves a
 * request with its runtime dependencies injected once, and the accessors that
 * read those dependencies from the running Worker (the Images binding, the edge
 * cache, and the "run this after the response" hook). Each accessor comes back
 * empty where the runtime has none (plain Node, tests), so the proxy still
 * works there, just without scaling or a cache.
 *
 * This file is kept out of the package index so none of it reaches the client
 * bundle; the route imports it directly.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';

import { isImagesBinding } from '@/lib/cloudflare/images/proxy';
import { serveImage } from '@/lib/cloudflare/images/service';
import type { ImagesLike } from '@/lib/cloudflare/images/proxy';
import type {
  ImageCache,
  ImageServiceDeps,
} from '@/lib/cloudflare/images/service';

/** The Images binding, where the deployment has one. */
export function imagesBinding(): ImagesLike | undefined {
  try {
    const { env } = getCloudflareContext();
    const binding: unknown = 'IMAGES' in env ? env.IMAGES : undefined;
    return isImagesBinding(binding) ? binding : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a value can be used as the edge cache: it answers `match` and `put`. */
function isCache(value: unknown): value is ImageCache {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const hasMatch = 'match' in value && typeof value.match === 'function';
  return hasMatch && 'put' in value && typeof value.put === 'function';
}

/** Cloudflare's per-location cache; absent when running under plain Node. */
export function imageCache(): ImageCache | undefined {
  const store: unknown = 'caches' in globalThis ? globalThis.caches : undefined;
  const cache: unknown =
    typeof store === 'object' && store !== null && 'default' in store
      ? store.default
      : undefined;
  return isCache(cache) ? cache : undefined;
}

/**
 * Run work after the response has been sent, without blocking it. A failure is
 * logged and swallowed, because storing a copy must never turn a good answer
 * into an error. Outside a Workers request the promise simply runs on its own.
 */
export function runInBackground(work: Promise<unknown>): void {
  const guarded = (async () => {
    try {
      await work;
    } catch (error: unknown) {
      console.error('image background task failed', error);
    }
  })();
  try {
    getCloudflareContext().ctx.waitUntil(guarded);
  } catch {
    // No request context: the promise already runs; nothing to extend.
  }
}

/**
 * The image proxy as a handle: build it with the access rules and the runtime
 * dependencies, then answer requests through {@link serve}.
 */
export class ImageService {
  readonly #deps: ImageServiceDeps;

  constructor(deps: ImageServiceDeps) {
    this.#deps = deps;
  }

  /** Serve one `/img` request: see {@link serveImage}. */
  async serve(request: Request): Promise<Response> {
    return serveImage(request, this.#deps);
  }
}
