/**
 * @packageDocumentation
 *
 * The logic behind `/oauth/token` and bearer-token checks, free of I/O: all
 * persistence goes through an {@link OAuthStore}, so the rules can be tested
 * with an in-memory fake and implemented over D1 in production.
 *
 * Security rules enforced here:
 *  - an authorization code works once; presenting it again revokes everything
 *    that was issued from it (a sign it was stolen);
 *  - PKCE must verify, and the client and redirect URI must match the request;
 *  - refresh tokens rotate on every use; presenting an old one again revokes
 *    the whole grant;
 *  - an access token is only good for the MCP server it was issued for.
 */

import { verifyPkce } from './pkce';
import {
  ACCESS_PREFIX,
  CODE_PREFIX,
  REFRESH_PREFIX,
  hashSecret,
  newSecret,
} from './secrets';
import { SUPPORTED_SCOPES } from './scopes';

/** Access tokens live an hour; refresh tokens thirty days, renewed on use. */
export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Authorization codes are good for ten minutes at most. */
export const CODE_TTL_SECONDS = 60 * 10;

/** A stored authorization code. */
export interface CodeRecord {
  clientId: string;
  userId: number;
  redirectUri: string;
  codeChallenge: string;
  scope: string[];
  resource: string;
  expiresAt: number;
  /** Set once the code has been redeemed. */
  grantId: string | null;
}

/** A user's approval of a client. */
export interface GrantRecord {
  id: string;
  userId: number;
  clientId: string;
  scope: string[];
  resource: string;
  revoked: boolean;
  lastUsedAt: number | null;
}

/** A stored token with its grant. */
export interface TokenRecord {
  kind: 'access' | 'refresh';
  expiresAt: number;
  usedAt: number | null;
  grant: GrantRecord;
}

/** Everything the token logic needs from storage. */
export interface OAuthStore {
  saveCode(hash: string, code: CodeRecord): Promise<void>;
  findCode(hash: string): Promise<CodeRecord | undefined>;
  /** Atomically claim a code; false if it was already claimed. */
  claimCode(hash: string, grantId: string): Promise<boolean>;
  createGrant(
    grant: Omit<GrantRecord, 'revoked' | 'lastUsedAt'>,
  ): Promise<void>;
  revokeGrant(grantId: string): Promise<void>;
  saveTokens(
    tokens: {
      hash: string;
      kind: 'access' | 'refresh';
      grantId: string;
      expiresAt: number;
    }[],
  ): Promise<void>;
  findToken(hash: string): Promise<TokenRecord | undefined>;
  /** Atomically mark a refresh token used; false if it already was. */
  markTokenUsed(hash: string, now: number): Promise<boolean>;
  touchGrant(grantId: string, now: number): Promise<void>;
}

/** An OAuth error response. */
export interface OAuthFailure {
  ok: false;
  error: string;
  description: string;
}

/** A successful token response body. */
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

const fail = (error: string, description: string): OAuthFailure => ({
  ok: false,
  error,
  description,
});

/** Mint a one-time authorization code for an approved request. */
export async function issueAuthorizationCode(
  store: OAuthStore,
  record: Omit<CodeRecord, 'expiresAt' | 'grantId'>,
  now: number,
): Promise<string> {
  const code = newSecret(CODE_PREFIX);
  await store.saveCode(await hashSecret(code), {
    ...record,
    expiresAt: now + CODE_TTL_SECONDS,
    grantId: null,
  });
  return code;
}

/** Issue a fresh access + refresh pair under a grant. */
async function issueTokens(
  store: OAuthStore,
  grantId: string,
  scope: string[],
  now: number,
): Promise<TokenResponse> {
  const access = newSecret(ACCESS_PREFIX);
  const refresh = newSecret(REFRESH_PREFIX);
  await store.saveTokens([
    {
      hash: await hashSecret(access),
      kind: 'access',
      grantId,
      expiresAt: now + ACCESS_TTL_SECONDS,
    },
    {
      hash: await hashSecret(refresh),
      kind: 'refresh',
      grantId,
      expiresAt: now + REFRESH_TTL_SECONDS,
    },
  ]);
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh,
    scope: scope.join(' '),
  };
}

/** The parameters of an `authorization_code` token request. */
export interface CodeExchange {
  code: string;
  clientId: string;
  redirectUri: string | undefined;
  codeVerifier: string | undefined;
  /** The `resource` in the request, if sent. */
  resource: string | undefined;
}

/** Redeem an authorization code for tokens. */
export async function exchangeAuthorizationCode(
  store: OAuthStore,
  request: CodeExchange,
  isOurResource: (resource: string) => boolean,
  now: number,
): Promise<TokenResponse | OAuthFailure> {
  const hash = await hashSecret(request.code);
  const code = await store.findCode(hash);
  if (!code) {
    return fail('invalid_grant', 'The authorization code is not valid.');
  }
  if (code.grantId) {
    // A used code coming back means someone copied it: revoke what it made.
    await store.revokeGrant(code.grantId);
    return fail('invalid_grant', 'The authorization code was already used.');
  }
  if (code.expiresAt <= now) {
    return fail('invalid_grant', 'The authorization code has expired.');
  }
  if (code.clientId !== request.clientId) {
    return fail('invalid_grant', 'The code was issued to a different client.');
  }
  if (request.redirectUri !== code.redirectUri) {
    return fail(
      'invalid_grant',
      'The redirect_uri does not match the request.',
    );
  }
  if (
    !request.codeVerifier ||
    !(await verifyPkce(request.codeVerifier, code.codeChallenge))
  ) {
    return fail('invalid_grant', 'The PKCE code_verifier does not match.');
  }
  if (request.resource !== undefined && !isOurResource(request.resource)) {
    return fail('invalid_target', 'The resource is not this MCP server.');
  }

  const grantId = crypto.randomUUID();
  if (!(await store.claimCode(hash, grantId))) {
    return fail('invalid_grant', 'The authorization code was already used.');
  }
  await store.createGrant({
    id: grantId,
    userId: code.userId,
    clientId: code.clientId,
    scope: code.scope,
    resource: code.resource,
  });
  return issueTokens(store, grantId, code.scope, now);
}

/** The parameters of a `refresh_token` request. */
export interface RefreshExchange {
  refreshToken: string;
  clientId: string;
  /** The scope asked for, which may not exceed the grant (and does not narrow it). */
  scope: string | undefined;
}

/** Exchange a refresh token for a new pair, rotating the refresh token. */
export async function exchangeRefreshToken(
  store: OAuthStore,
  request: RefreshExchange,
  now: number,
): Promise<TokenResponse | OAuthFailure> {
  const hash = await hashSecret(request.refreshToken);
  const token = await store.findToken(hash);
  if (!token || token.kind !== 'refresh') {
    return fail('invalid_grant', 'The refresh token is not valid.');
  }
  const { grant } = token;
  if (grant.revoked) {
    return fail('invalid_grant', 'Access for this application was revoked.');
  }
  if (grant.clientId !== request.clientId) {
    return fail(
      'invalid_grant',
      'The refresh token belongs to a different client.',
    );
  }
  if (token.usedAt !== null) {
    // An already-rotated token came back: assume theft and end the grant.
    await store.revokeGrant(grant.id);
    return fail('invalid_grant', 'The refresh token was already used.');
  }
  if (token.expiresAt <= now) {
    return fail('invalid_grant', 'The refresh token has expired.');
  }

  if (request.scope) {
    const asked = request.scope.split(/\s+/).filter(Boolean);
    if (
      !asked.every(
        (s) => grant.scope.includes(s) && SUPPORTED_SCOPES.includes(s),
      )
    ) {
      return fail(
        'invalid_scope',
        'Cannot widen the scope of a refresh token.',
      );
    }
  }
  if (!(await store.markTokenUsed(hash, now))) {
    await store.revokeGrant(grant.id);
    return fail('invalid_grant', 'The refresh token was already used.');
  }
  // Tokens are not scoped one by one: whatever was asked, the new pair carries
  // the whole grant's scope, and the response says so rather than pretending to
  // have narrowed it.
  return issueTokens(store, grant.id, grant.scope, now);
}

/** Who a valid access token speaks for. */
export interface AccessIdentity {
  userId: number;
  scope: string[];
  grantId: string;
}

/** How often to record that a grant is in use (saves a write per request). */
const TOUCH_INTERVAL_SECONDS = 60 * 5;

/**
 * Resolve a bearer access token to the user and scopes it grants, or undefined
 * if it is unknown, expired, revoked, a refresh token, or for another server.
 */
export async function authenticateAccessToken(
  store: OAuthStore,
  accessToken: string,
  resource: string,
  now: number,
): Promise<AccessIdentity | undefined> {
  const token = await store.findToken(await hashSecret(accessToken));
  if (!token || token.kind !== 'access' || token.expiresAt <= now) {
    return undefined;
  }
  const { grant } = token;
  if (grant.revoked || grant.resource !== resource) {
    return undefined;
  }
  if (
    grant.lastUsedAt === null ||
    now - grant.lastUsedAt > TOUCH_INTERVAL_SECONDS
  ) {
    await store.touchGrant(grant.id, now);
  }
  return { userId: grant.userId, scope: grant.scope, grantId: grant.id };
}

/** Revoke the grant a token belongs to (RFC 7009). Unknown tokens are ignored. */
export async function revokeToken(
  store: OAuthStore,
  token: string,
): Promise<void> {
  const found = await store.findToken(await hashSecret(token));
  if (found) {
    await store.revokeGrant(found.grant.id);
  }
}
