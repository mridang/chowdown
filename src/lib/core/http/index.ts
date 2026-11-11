/**
 * @packageDocumentation
 *
 * The HTTP framework/platform layer: the Worker request pipeline (serve), the
 * edge cache and rate limits, the Content-Security-Policy and its reports, the
 * security/cache response headers, the client address, and the per-app surface
 * these read.
 */
export {
  type ServeEnv,
  type ServeApp,
  type ServeDeps,
  serverTiming,
  serve,
} from './serve';
export { EDGE_LIMITS } from './extras';
export {
  isEdgeCacheable,
  edgeCacheKey,
  storableCopy,
  withFreshNonce,
  edgeCache,
} from './edge-cache';
export {
  type RateLimitBinding,
  type Counted,
  type RefusalStyle,
  type ClassSpec,
  type GenericClass,
  GENERIC_CLASSES,
  OVERALL_BINDING,
  type EdgeLimitEnv,
  type EdgeLimits,
  genericClass,
  genericLimits,
  counterKey,
  tooManyRequests,
  edgeLimitRefusal,
} from './edge-limits';
export {
  CSP_REPORT_PATH,
  CSP_REPORT_GROUP,
  REPORTING_ENDPOINTS,
  CSP_REPORT_DIRECTIVES,
} from './reporting';
export {
  newNonce,
  type CspSurface,
  buildCsp,
  cspSurfaceFor,
  nonceOf,
  forwardedHeaders,
} from './csp';
export {
  type ReportSummary,
  MAX_REPORTS_PER_REQUEST,
  summariseReports,
} from './csp-reports';
export {
  SECURITY_HEADERS,
  resourcePolicyFor,
  openerPolicyFor,
  replacingHeaders,
  applyResponseHeaders,
} from './headers';
export {
  UNKNOWN_ADDRESS,
  addressSubject,
  clientSubject,
} from './client-address';
export {
  PUBLIC_PAGES,
  EDGE_CACHED_PAGES,
  CACHED_QUERY_PARAMS,
  EDGE_TTL_SECONDS,
  OPEN_FILES,
  RARELY_CHANGING,
  EXTRA_IMG_SOURCES,
  EXTRA_DIRECTIVES,
  STATIC_PREFIXES,
  DISCOVERY_PATHS,
  PAGE_CACHE_RULES,
} from './site';
