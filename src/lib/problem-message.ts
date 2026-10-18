/**
 * @packageDocumentation
 *
 * Turning an API error response (RFC 9457 problem details) into a sentence for
 * the user: the problem's `detail` if it has one, otherwise its `title`, plus any
 * per-field messages. Safe to call on any response; falls back to the status.
 */

/** The readable message from a failed API response. */
export async function problemMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      title?: string;
      detail?: string;
      errors?: string[];
    };
    const main = body.detail ?? body.title ?? `Request failed (${res.status}).`;
    return body.errors?.length ? `${main} ${body.errors.join(' ')}` : main;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

/** An API refusal, carrying the sentence to show the user. */
export class ProblemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProblemError';
  }
}

/** The error to throw for a failed API response, to be shown with {@link problemText}. */
export async function problemError(res: Response): Promise<ProblemError> {
  return new ProblemError(await problemMessage(res));
}

/**
 * What to show for a caught error: the API's own words if it refused, otherwise
 * `fallback` (a network failure's "Failed to fetch" helps nobody).
 */
export function problemText(error: unknown, fallback: string): string {
  return error instanceof ProblemError ? error.message : fallback;
}
