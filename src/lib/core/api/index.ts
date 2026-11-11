/**
 * @packageDocumentation
 *
 * The server-side REST/JSON layer for the API, in one package: the pure
 * primitives — RFC 9457 problem responses and the standard catalogue, size-
 * and type-checked body reading, and the cursor-pagination primitives — the
 * success vocabulary (`ok`/`created`/`noContent`/`page`) a handler returns, and
 * the Next-aware ApiController that wires typed endpoints to them and renders
 * the response. The browser-side helper for reading these responses lives in
 * `@/components/api`, not here.
 */
export { type ProblemBody, problem, problems } from './problem';
export {
  type Body,
  readJson,
  type ObjectBody,
  readJsonObject,
  isObject,
} from './json';
export {
  type TextBody,
  type JsonBody,
  type FormBody,
  readBodyText,
  readJsonBody,
  readFormBody,
} from './body';
export {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type CursorPosition,
  encodeCursor,
  decodeCursor,
  parseLimit,
  type Slice,
  sliceAfter,
} from './pagination';
export { entityTag, ifMatchSatisfied, ifNoneMatchHit } from './etag';
export { ok, created, accepted, noContent, page } from './results';
export {
  type HttpMethod,
  type ApiResponse,
  type Endpoint,
  type ApiControllerOptions,
  type RouteHandler,
  ApiController,
} from './controller';
export { type IdContext, type RouteContext } from './route-context';
