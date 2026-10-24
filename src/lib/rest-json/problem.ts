/**
 * @packageDocumentation
 *
 * Error responses for the REST API, as RFC 9457 problem details
 * (`application/problem+json`) — every 4xx and 5xx the API sends has this shape.
 * `type` is a relative URI naming the kind of problem; it identifies the problem
 * and need not be resolvable. Details are written for API clients and never
 * include stack traces or internals.
 */

/** The members of a problem document. */
export interface ProblemBody {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  /** Extension member: per-field validation messages. */
  readonly errors?: readonly string[];
}

/** Build a problem response. */
export function problem(
  status: number,
  type: string,
  title: string,
  detail?: string,
  extra: {
    readonly errors?: readonly string[];
    readonly headers?: Readonly<Record<string, string>>;
  } = {},
): Response {
  const body: ProblemBody = {
    type,
    title,
    status,
    ...(detail ? { detail } : {}),
    ...(extra.errors && extra.errors.length > 0
      ? { errors: extra.errors }
      : {}),
  };
  return Response.json(body, {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      'Cache-Control': 'no-store',
      ...extra.headers,
    },
  });
}

/**
 * A problem raised as an exception, carrying the response to send. A controller
 * (or any caller) catches it and returns {@link ProblemError.response}, so a
 * decode/handle step can refuse by throwing instead of threading a result.
 */
export class ProblemError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super('problem');
    this.name = 'ProblemError';
    this.response = response;
  }
}

/** The standard problems, so every route words them the same way. */
export const problems = {
  unauthorized: () =>
    problem(401, '/problems/unauthorized', 'Unauthorized', 'Sign in first.'),

  rateLimited: (detail: string, retryAfterSeconds: number) =>
    problem(429, '/problems/rate-limited', 'Too many requests', detail, {
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }),

  forbidden: (detail: string) =>
    problem(403, '/problems/forbidden', 'Forbidden', detail),

  notFound: (what: string) =>
    problem(404, '/problems/not-found', 'Not found', `No such ${what}.`),

  badRequest: (detail: string, errors?: readonly string[]) =>
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

  /** The request needs Google Drive and the person hasn't connected it. */
  driveNotConnected: () =>
    problem(
      409,
      '/problems/drive-not-connected',
      'Google Drive is not connected',
      'Connect your Google Drive in chowdown first, then try again.',
    ),

  /** Drive (or another upstream) failed; nothing was changed. */
  upstream: (detail: string) =>
    problem(502, '/problems/upstream-failure', 'Upstream failure', detail),
};
