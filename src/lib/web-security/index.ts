/**
 * @packageDocumentation
 *
 * Small, framework-free web-security helpers: the same-origin (CSRF) check, the
 * one-time OAuth `state` value, and safe same-site return paths.
 */
export { isSameOriginPost } from './csrf';
export {
  checkState,
  // eslint-disable-next-line unicorn/no-keyword-prefix -- the name is exported from its module and used by other modules
  newState,
  purposeOf,
  SIGN_IN_PURPOSE,
  STATE_TTL_SECONDS,
  type StateCheck,
} from './oauth-state';
export { safeReturnPath } from './return-to';
