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
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly response: NextResponse };

/**
 * Read the request body as JSON. `mediaTypes` lists the acceptable
 * `Content-Type`s; `application/json` is always acceptable.
 */
export async function readJson(
  request: Request,
  mediaTypes: readonly string[] = [],
): Promise<Body> {
  const accepted = ['application/json', ...mediaTypes];
  // Only the media type matters; parameters such as `charset` are ignored.
  const [essence = ''] = (request.headers.get('content-type') ?? '').split(';');
  const type = essence.trim().toLowerCase();
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

/** A parsed JSON object, or the problem response to send. */
export type ObjectBody =
  | {
      readonly ok: true;
      readonly value: Readonly<Record<string, unknown>>;
    }
  | { readonly ok: false; readonly response: NextResponse };

/**
 * Read the request body as a JSON object. `notObject` is the sentence for a
 * body that is JSON but not an object ("The patch must be a JSON object.").
 */
export async function readJsonObject(
  request: Request,
  notObject: string,
  mediaTypes: readonly string[] = [],
): Promise<ObjectBody> {
  const body = await readJson(request, mediaTypes);
  if (!body.ok) {
    return body;
  }
  return isObject(body.value)
    ? { ok: true, value: body.value }
    : { ok: false, response: problems.badRequest(notObject) };
}

/** Whether a parsed body is a plain JSON object. */
export function isObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
