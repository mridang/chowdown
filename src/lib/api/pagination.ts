/**
 * @packageDocumentation
 *
 * Cursor-based pagination for list endpoints. The cursor is an opaque token
 * that clients pass back unchanged; inside it is the sort key and id of the last
 * item on the previous page, so the next page starts right after it even if
 * items were added or removed meanwhile. Pages carry `self` and `next` as
 * absolute URLs, `items`, and no total count.
 */

import { NextResponse } from 'next/server';

import { appOrigin } from '../util';
import { base64UrlToBytes, bytesToBase64Url } from '../util/base64';
import { setSearchParams } from '../util/url';
import { problems } from './problem';

/** Default and maximum page sizes. */
export const DEFAULT_LIMIT = 20;
/** The largest page a client may ask for. */
export const MAX_LIMIT = 100;

/** Where a page starts after. */
export interface CursorPosition {
  readonly key: string;
  readonly id: string;
}

/** Encode a position as an opaque url-safe token. */
export function encodeCursor(position: CursorPosition): string {
  const json = JSON.stringify([position.key, position.id]);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

/** Decode a cursor, or undefined if it isn't one we issued. */
export function decodeCursor(cursor: string): CursorPosition | undefined {
  try {
    const bytes = base64UrlToBytes(cursor);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return { key: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through
  }
  return undefined;
}

/** The validated `limit` query parameter. */
export function parseLimit(
  raw: string | null,
  fallback = DEFAULT_LIMIT,
): number | NextResponse {
  if (raw === null) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    return problems.badRequest(
      `limit must be a whole number from 1 to ${MAX_LIMIT}.`,
    );
  }
  return n;
}

/** One page of already-sorted items. */
export interface Slice<T> {
  readonly items: readonly T[];
  /** Position of the last item, when more follow. */
  readonly next?: CursorPosition;
}

/**
 * Take the page that follows `after` from a sorted list. `compare` orders two
 * positions the same way the list is sorted.
 */
export function sliceAfter<T>(
  sorted: readonly T[],
  positionOf: (item: T) => CursorPosition,
  compare: (a: CursorPosition, b: CursorPosition) => number,
  after: CursorPosition | undefined,
  limit: number,
): Slice<T> {
  const rest = after
    ? sorted.filter((item) => compare(positionOf(item), after) > 0)
    : sorted;
  const items = rest.slice(0, limit);
  const last = items.at(-1);
  return rest.length > limit && last
    ? { items, next: positionOf(last) }
    : { items };
}

/**
 * The request URL as an absolute URL on the app's public origin (scheme and
 * host from the origin; path, query and fragment from the request). Passing
 * `search` swaps the query string.
 */
function absolute(request: Request, search?: string): URL {
  const url = new URL(request.url);
  const origin = new URL(appOrigin(request));
  const query = search === undefined ? url.search : search;
  return new URL(
    `${origin.protocol}//${origin.host}${url.pathname}${query}${url.hash}`,
  );
}

/** The response page: `self`, `next` (when there is one) and `items`. */
export function pageBody<T>(
  request: Request,
  items: readonly T[],
  next?: CursorPosition,
): {
  readonly self: string;
  readonly next?: string;
  readonly items: readonly T[];
} {
  const self = absolute(request);
  return next
    ? {
        self: self.toString(),
        items,
        next: absolute(
          request,
          setSearchParams(self.search, { cursor: encodeCursor(next) }),
        ).toString(),
      }
    : { self: self.toString(), items };
}

/** An absolute URL for a path on the app's public origin. */
export function absoluteUrl(request: Request, path: string): string {
  return `${appOrigin(request)}${path}`;
}
