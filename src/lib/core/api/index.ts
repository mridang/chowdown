/**
 * @packageDocumentation
 *
 * Public surface of the core/api package: the Next-aware REST controller
 * framework (ApiController + the route-context shapes and cursor pagination)
 * built on the pure REST/JSON primitives (RFC 9457 problems, size-checked body
 * reading, JSON helpers, ETags) that used to live in lib/rest-json.
 */
export * from './controller';
export * from './route-context';
export * from './pagination';
export * from './problem';
export * from './problem-message';
export * from './json';
export * from './body';
export * from './etag';
