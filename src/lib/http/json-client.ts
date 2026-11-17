/**
 * @packageDocumentation
 *
 * A minimal JSON-over-HTTP client: build the URL, fetch through an injected
 * `fetch`, read the body once, and decode it with a Zod schema. Every outcome
 * — HTTP error, invalid JSON, schema mismatch, success — comes back as a
 * {@link Result}, never a throw, so a service client built on this is a thin
 * map of (path, query, schema) to typed results.
 */

import type { ZodType } from 'zod';

import type { Result } from './result';

/** One request: a path appended to the base URL, optional query and fetch init. */
export interface JsonRequest {
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly init?: RequestInit;
}

/** Sends JSON requests to one base URL and decodes responses with Zod. @public */
export class JsonClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch,
  ) {}

  /** Fetch `req` and decode the body with `schema`. */
  public async request<T>(
    req: JsonRequest,
    schema: ZodType<T>,
  ): Promise<Result<T>> {
    const base = new URL(this.baseUrl + req.path);
    const url = req.query
      ? new URL(`?${new URLSearchParams(req.query).toString()}`, base)
      : base;
    try {
      const response = await this.fetcher(url, req.init);
      const { status, ok } = response;
      try {
        const raw = await response.text();
        if (!ok) {
          return { ok: false, error: `http ${status}`, raw, status };
        }
        const parsed = ((): { value: unknown } | { error: string } => {
          try {
            return { value: JSON.parse(raw) as unknown };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : 'invalid JSON',
            };
          }
        })();
        if ('error' in parsed) {
          return { ok: false, error: parsed.error, raw, status };
        }
        const decoded = schema.safeParse(parsed.value);
        return decoded.success
          ? { ok: true, value: decoded.data, raw, status }
          : { ok: false, error: decoded.error.message, raw, status };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          raw: '',
          status,
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        raw: '',
      };
    }
  }
}
