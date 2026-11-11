/**
 * @packageDocumentation
 *
 * Public surface of the Google OAuth client package: the
 * {@link GoogleOAuthClient} and its request/response models.
 */

export { GoogleOAuthClient, SIGN_IN_SCOPES } from './client';
export type { GoogleOAuthCredentials } from './client';
export {
  ExchangeCodeRequestSchema,
  type ExchangeCodeRequest,
  TokenResponseSchema,
  type TokenResponse,
  RefreshTokenRequestSchema,
  type RefreshTokenRequest,
  AccessTokenResponseSchema,
  type AccessTokenResponse,
  GoogleUserResponseSchema,
  type GoogleUserResponse,
  RevokeTokenRequestSchema,
  type RevokeTokenRequest,
  RevokeTokenResponseSchema,
  type RevokeTokenResponse,
} from './models';
