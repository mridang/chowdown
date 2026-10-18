/**
 * @packageDocumentation
 *
 * Reading JSON request bodies for the REST API: checks the media type (415 if
 * it's wrong) and the syntax (400 if it isn't JSON), so each route can assume a
 * parsed value and focus on validating its fields.
 */

import type { NextResponse } from 'next/server';

import { problems } from './problem';

/** A parsed body, or the problem response to send. */
export type Body =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

/**
 * Read the request body as JSON. `mediaTypes` lists the acceptable
 * `Content-Type`s; `application/json` is always acceptable.
 */
export async function readJson(
  request: Request,
  mediaTypes: string[] = [],
): Promise<Body> {
  const accepted = ['application/json', ...mediaTypes];
  const type = (request.headers.get('content-type') ?? '')
    .split(';')[0]!
    .trim()
    .toLowerCase();
  if (!accepted.includes(type)) {
    return {
      ok: false,
      response: problems.unsupportedMediaType(accepted.join(' or ')),
    };
  }
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: problems.badRequest('The request body is not valid JSON.'),
    };
  }
}

/** Whether a parsed body is a plain JSON object. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
