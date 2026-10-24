/**
 * @packageDocumentation
 *
 * A small controller framework over the pure REST primitives in lib/rest-json.
 * Register typed endpoints — `decode` turns the request into typed input (throw
 * a {@link ProblemError} for a 4xx), `handle` does the work, `encode` shapes the
 * answer — and it wires problem+json, status, ETag and error mapping, and hands
 * back the method handlers a Next route file re-exports. Endpoints grow without
 * touching the route file.
 *
 * Genuinely bespoke endpoints (content negotiation, idempotent 204s, Drive
 * failure mapping, `Location` headers) stay as thin hand-written handlers; this
 * is for the standard read/list/mutate ones, so they read the same everywhere.
 */

import { ProblemError, problem } from '@/lib/rest-json/problem';

/** The HTTP methods a controller can answer. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** How an endpoint's output becomes a response. */
export interface ApiResponse {
  /** Defaults to 200, or 204 when there is no body. */
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Sent as the `ETag` header. */
  readonly etag?: string;
  /** The JSON body; omitted for an empty response. */
  readonly body?: unknown;
}

/** One endpoint: decode the request, handle it, encode the answer. */
export interface Endpoint<Input, Output, Ctx> {
  readonly method: HttpMethod;
  /** Turn the request into typed input; throw a {@link ProblemError} for a 4xx. Defaults to no input. */
  decode?(request: Request, ctx: Ctx): Promise<Input> | Input;
  /** Do the work; throw a {@link ProblemError} to refuse. May return a Response to send as-is. */
  handle(
    input: Input,
    ctx: Ctx,
  ): Promise<Output | Response> | Output | Response;
  /** Shape the answer; defaults to a 200 JSON body of the output. */
  encode?(output: Output, ctx: Ctx): ApiResponse;
}

/** How a controller builds its per-request context and maps unexpected errors. */
export interface ControllerOptions<Ctx, RouteArg> {
  /** Build the per-request context (auth, ids). Throw a {@link ProblemError} to refuse. */
  context?(request: Request, route: RouteArg): Promise<Ctx> | Ctx;
  /** Map an error that is not a {@link ProblemError} to a response. Defaults to a 500 problem. */
  onError?(error: unknown): Response;
}

/** The default 500 for an error a controller did not expect. */
function serverError(): Response {
  return problem(
    500,
    '/problems/server-error',
    'Server error',
    'Something went wrong.',
  );
}

/** Build the Response for an encoded answer. */
function respond(encoded: ApiResponse): Response {
  const headers = new Headers(encoded.headers);
  if (encoded.etag) {
    headers.set('ETag', encoded.etag);
  }
  if (encoded.body === undefined) {
    return new Response(null, { status: encoded.status ?? 204, headers });
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(encoded.body), {
    status: encoded.status ?? 200,
    headers,
  });
}

/**
 * A controller for one route path. Register endpoints with {@link on} and
 * mount the result with {@link handlers}.
 */
export class ApiController<Ctx = undefined, RouteArg = unknown> {
  readonly #options: ControllerOptions<Ctx, RouteArg>;
  readonly #endpoints = new Map<HttpMethod, Endpoint<unknown, unknown, Ctx>>();

  constructor(options: ControllerOptions<Ctx, RouteArg> = {}) {
    this.#options = options;
  }

  /** Register an endpoint. One per method. */
  on<Input, Output>(endpoint: Endpoint<Input, Output, Ctx>): this {
    this.#endpoints.set(
      endpoint.method,
      endpoint as Endpoint<unknown, unknown, Ctx>,
    );
    return this;
  }

  /** Run one endpoint through the decode → handle → encode pipeline. */
  async #run(
    endpoint: Endpoint<unknown, unknown, Ctx>,
    request: Request,
    route: RouteArg,
  ): Promise<Response> {
    try {
      const ctx = (
        this.#options.context
          ? await this.#options.context(request, route)
          : undefined
      ) as Ctx;
      const input = endpoint.decode
        ? await endpoint.decode(request, ctx)
        : undefined;
      const output = await endpoint.handle(input, ctx);
      // A handler that already produced a Response (a bespoke body it builds
      // itself — content negotiation, a delegated helper) is sent as-is.
      if (output instanceof Response) {
        return output;
      }
      const encoded = endpoint.encode
        ? endpoint.encode(output, ctx)
        : ({ body: output } as ApiResponse);
      return respond(encoded);
    } catch (error) {
      if (error instanceof ProblemError) {
        return error.response;
      }
      return this.#options.onError?.(error) ?? serverError();
    }
  }

  /** The handler for one registered method, for a route file to re-export. */
  handler(
    method: HttpMethod,
  ): (request: Request, route?: RouteArg) => Promise<Response> {
    const endpoint = this.#endpoints.get(method);
    if (!endpoint) {
      throw new Error(`No ${method} endpoint is registered`);
    }
    return (request, route) => this.#run(endpoint, request, route as RouteArg);
  }

  /** The method handlers a Next route file re-exports; an unknown method is a 405. */
  handlers(): Partial<
    Record<
      HttpMethod,
      (request: Request, route?: RouteArg) => Promise<Response>
    >
  > {
    const out: Partial<
      Record<
        HttpMethod,
        (request: Request, route?: RouteArg) => Promise<Response>
      >
    > = {};
    for (const [method] of this.#endpoints) {
      out[method] = this.handler(method);
    }
    return out;
  }
}
