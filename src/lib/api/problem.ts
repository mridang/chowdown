/**
 * @packageDocumentation
 *
 * Error responses for the REST API, as RFC 9457 problem details
 * (`application/problem+json`) — every 4xx and 5xx the API sends has this shape.
 * `type` is a relative URI naming the kind of problem; it identifies the problem
 * and need not be resolvable. Details are written for API clients and never
 * include stack traces or internals.
 */

import { NextResponse } from 'next/server';

/** The members of a problem document. */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  /** Extension member: per-field validation messages. */
  errors?: string[];
}

/** Build a problem response. */
export function problem(
  status: number,
  type: string,
  title: string,
  detail?: string,
  extra: { errors?: string[]; headers?: Record<string, string> } = {},
): NextResponse {
  const body: ProblemBody = { type, title, status };
  if (detail) {
    body.detail = detail;
  }
  if (extra.errors && extra.errors.length > 0) {
    body.errors = extra.errors;
  }
  return NextResponse.json(body, {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      'Cache-Control': 'no-store',
      ...extra.headers,
    },
  });
}

/** The standard problems, so every route words them the same way. */
export const problems = {
  unauthorized: () =>
    problem(401, '/problems/unauthorized', 'Unauthorized', 'Sign in first.'),

  forbidden: (detail: string) =>
    problem(403, '/problems/forbidden', 'Forbidden', detail),

  notFound: (what: string) =>
    problem(404, '/problems/not-found', 'Not found', `No such ${what}.`),

  badRequest: (detail: string, errors?: string[]) =>
    problem(400, '/problems/bad-request', 'Bad request', detail, { errors }),

  unsupportedMediaType: (expected: string) =>
    problem(
      415,
      '/problems/unsupported-media-type',
      'Unsupported media type',
      `Send the request body as ${expected}.`,
    ),

  preconditionFailed: () =>
    problem(
      412,
      '/problems/precondition-failed',
      'Precondition failed',
      'The resource changed since you last read it. Fetch it again and retry.',
    ),

  /** Drive (or another upstream) failed; nothing was changed. */
  upstream: (detail: string) =>
    problem(502, '/problems/upstream-failure', 'Upstream failure', detail),
};
