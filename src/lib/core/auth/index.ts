/**
 * @packageDocumentation
 *
 * The framework-tier auth bindings: resolving the current user, reading and
 * writing the session cookie and the OAuth flow cookies, the sign-out guard,
 * and the GoogleAuthKit that composes a Google sign-in.
 */
export {
  getCurrentUser,
  getSession,
  getSessionUid,
  getLiveSessionUid,
} from './current-user';
export { setSessionCookie } from './session-cookie';
export { type FlowStart, startFlowCookies, finishFlow } from './flow-cookies';
export { crossSiteRefusal, type Caller, requireSignedIn } from './guard';
export { type GoogleAuthKitConfig, GoogleAuthKit } from './google-auth-kit';
