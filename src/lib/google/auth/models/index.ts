/**
 * @packageDocumentation
 *
 * The Google OAuth request/response models: one Zod schema and its inferred
 * type per file. The schemas carry any per-field quirks so the client stays a
 * thin map of endpoint to typed result.
 */

export {
  ExchangeCodeRequestSchema,
  type ExchangeCodeRequest,
} from './exchange-code-request';
export { TokenResponseSchema, type TokenResponse } from './token-response';
export {
  RefreshTokenRequestSchema,
  type RefreshTokenRequest,
} from './refresh-token-request';
export {
  AccessTokenResponseSchema,
  type AccessTokenResponse,
} from './access-token-response';
export {
  GoogleUserResponseSchema,
  type GoogleUserResponse,
} from './google-user-response';
export {
  RevokeTokenRequestSchema,
  type RevokeTokenRequest,
} from './revoke-token-request';
export {
  RevokeTokenResponseSchema,
  type RevokeTokenResponse,
} from './revoke-token-response';
