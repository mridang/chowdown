/**
 * Cover photos, served from our own address (see `lib/images/cover-proxy.ts`
 * for why).
 *
 *   GET /api/cover-images?url=<photo address>&w=<width>
 *
 * Only signed-in people may use it, and only for photos their own recipes list,
 * so it can't become a free image proxy for the web. Answers come from the edge
 * cache when they can.
 */

import { problems } from '@/lib/api/problem';
import { getSessionUid } from '@/lib/auth/current-user';
import { edgeCache } from '@/lib/http/edge-cache';
import {
  isImagesBinding,
  snapWidth,
  type ImagesLike,
} from '@/lib/images/cover-proxy';
import { userHasCover } from '@/lib/images/cover-ownership';
import { serveCover } from '@/lib/images/cover-service';
import { getDatabase, getEnv, runInBackground } from '@/lib/util';

/** The width used when a request does not name a usable one. */
const DEFAULT_WIDTH = 640;

/** The Images binding, where the deployment has one. */
function imagesBinding(): ImagesLike | undefined {
  try {
    const binding: unknown = Reflect.get(getEnv(), 'IMAGES');
    return isImagesBinding(binding) ? binding : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `GET /api/cover-images?url=…&w=…`: the photo at `url`, scaled to the nearest
 * allowed width and kept at the edge. Answers 200 with the image, 400 for an
 * address that is not a public image, 404 when none of the person's recipes
 * lists that photo or when the photo is gone, 502 when its site fails. Needs a
 * signed-in user: 401 without a session.
 */
export async function GET(request: Request): Promise<Response> {
  const uid = await getSessionUid();
  if (uid === null) {
    return problems.unauthorized();
  }
  const params = new URL(request.url).searchParams;
  return serveCover(
    params.get('url') ?? '',
    snapWidth(Number(params.get('w')) || DEFAULT_WIDTH),
    {
      cache: edgeCache(),
      images: imagesBinding(),
      mayFetch: (url) => userHasCover(getDatabase(), uid, url),
      background: runInBackground,
    },
  );
}
