/**
 * @packageDocumentation
 *
 * D1 persistence for the OAuth server: the client registry, grants, codes and
 * tokens. {@link createOAuthStore} adapts it to the {@link OAuthStore}
 * interface the token logic is written against.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';

import {
  fetchClientMetadata,
  isMetadataDocumentUrl,
  type OAuthClient,
} from '../oauth/client';
import type { OAuthStore, TokenRecord } from '../oauth/token-endpoint';
import type { Database } from './client';
import { oauthClients, oauthCodes, oauthGrants, oauthTokens } from './schema';

/** How long a fetched client metadata document is trusted before refetching. */
const CIMD_TTL_MS = 60 * 60 * 1000;

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
const seconds = (isoString: string | null) =>
  isoString === null ? null : Math.floor(Date.parse(isoString) / 1000);

type ClientRow = typeof oauthClients.$inferSelect;

function toClient(row: ClientRow): OAuthClient {
  return {
    clientId: row.client_id,
    name: row.client_name,
    redirectUris: JSON.parse(row.redirect_uris) as string[],
    kind: row.kind === 'cimd' ? 'cimd' : 'dcr',
  };
}

/** Save (or refresh) a client in the registry. */
export async function saveClient(
  db: Database,
  client: OAuthClient,
): Promise<void> {
  const now = new Date().toISOString();
  const values = {
    client_id: client.clientId,
    kind: client.kind,
    client_name: client.name,
    redirect_uris: JSON.stringify(client.redirectUris),
    created_at: now,
    fetched_at: client.kind === 'cimd' ? now : null,
  };
  await db
    .insert(oauthClients)
    .values(values)
    .onConflictDoUpdate({
      target: oauthClients.client_id,
      set: {
        client_name: values.client_name,
        redirect_uris: values.redirect_uris,
        fetched_at: values.fetched_at,
      },
    });
}

/**
 * Look a client up by `client_id`. A registered client comes straight from the
 * database. A metadata-document URL is fetched and cached; a stale cached copy
 * is refreshed, and still used if the refresh fails so a client's brief outage
 * doesn't lock users out.
 */
export async function resolveClient(
  db: Database,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OAuthClient | undefined> {
  const row = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.client_id, clientId),
  });
  if (!isMetadataDocumentUrl(clientId)) {
    return row ? toClient(row) : undefined;
  }
  const fresh =
    row?.fetched_at && Date.now() - Date.parse(row.fetched_at) < CIMD_TTL_MS;
  if (row && fresh) {
    return toClient(row);
  }
  const fetched = await fetchClientMetadata(clientId, fetchImpl);
  if (fetched.ok) {
    await saveClient(db, fetched.client);
    return fetched.client;
  }
  return row ? toClient(row) : undefined;
}

/** Adapt D1 to the store the token logic uses. */
export function createOAuthStore(db: Database): OAuthStore {
  return {
    async saveCode(hash, code) {
      await db.insert(oauthCodes).values({
        code_hash: hash,
        client_id: code.clientId,
        user_id: code.userId,
        redirect_uri: code.redirectUri,
        code_challenge: code.codeChallenge,
        scope: code.scope.join(' '),
        resource: code.resource,
        expires_at: code.expiresAt,
        grant_id: null,
      });
    },

    async findCode(hash) {
      const row = await db.query.oauthCodes.findFirst({
        where: eq(oauthCodes.code_hash, hash),
      });
      return row
        ? {
            clientId: row.client_id,
            userId: row.user_id,
            redirectUri: row.redirect_uri,
            codeChallenge: row.code_challenge,
            scope: row.scope.split(' '),
            resource: row.resource,
            expiresAt: row.expires_at,
            grantId: row.grant_id,
          }
        : undefined;
    },

    async claimCode(hash, grantId) {
      const result = await db
        .update(oauthCodes)
        .set({ grant_id: grantId })
        .where(and(eq(oauthCodes.code_hash, hash), isNull(oauthCodes.grant_id)))
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async createGrant(grant) {
      await db.insert(oauthGrants).values({
        id: grant.id,
        user_id: grant.userId,
        client_id: grant.clientId,
        scope: grant.scope.join(' '),
        resource: grant.resource,
        created_at: new Date().toISOString(),
      });
    },

    async revokeGrant(grantId) {
      await db
        .update(oauthGrants)
        .set({ revoked_at: new Date().toISOString() })
        .where(
          and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revoked_at)),
        );
    },

    async saveTokens(tokens) {
      for (const t of tokens) {
        await db.insert(oauthTokens).values({
          token_hash: t.hash,
          kind: t.kind,
          grant_id: t.grantId,
          expires_at: t.expiresAt,
        });
      }
    },

    async findToken(hash): Promise<TokenRecord | undefined> {
      const [row] = await db
        .select({ token: oauthTokens, grant: oauthGrants })
        .from(oauthTokens)
        .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grant_id))
        .where(eq(oauthTokens.token_hash, hash))
        .limit(1);
      if (!row) {
        return undefined;
      }
      return {
        kind: row.token.kind === 'access' ? 'access' : 'refresh',
        expiresAt: row.token.expires_at,
        usedAt: row.token.used_at,
        grant: {
          id: row.grant.id,
          userId: row.grant.user_id,
          clientId: row.grant.client_id,
          scope: row.grant.scope.split(' '),
          resource: row.grant.resource,
          revoked: row.grant.revoked_at !== null,
          lastUsedAt: seconds(row.grant.last_used_at),
        },
      };
    },

    async markTokenUsed(hash, now) {
      const result = await db
        .update(oauthTokens)
        .set({ used_at: now })
        .where(
          and(eq(oauthTokens.token_hash, hash), isNull(oauthTokens.used_at)),
        )
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async touchGrant(grantId, now) {
      await db
        .update(oauthGrants)
        .set({ last_used_at: iso(now) })
        .where(eq(oauthGrants.id, grantId));
    },
  };
}

/** An approved application as the user sees it in the app. */
export interface ConnectedApp {
  grantId: string;
  name: string;
  scope: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

/** The applications a user has approved and not revoked, newest first. */
export async function listConnectedApps(
  db: Database,
  userId: number,
): Promise<ConnectedApp[]> {
  const rows = await db
    .select({ grant: oauthGrants, name: oauthClients.client_name })
    .from(oauthGrants)
    .leftJoin(oauthClients, eq(oauthClients.client_id, oauthGrants.client_id))
    .where(and(eq(oauthGrants.user_id, userId), isNull(oauthGrants.revoked_at)))
    .orderBy(desc(oauthGrants.created_at));
  return rows.map((r) => ({
    grantId: r.grant.id,
    name: r.name ?? r.grant.client_id,
    scope: r.grant.scope.split(' '),
    connectedAt: r.grant.created_at,
    lastUsedAt: r.grant.last_used_at,
  }));
}

/** Revoke one of the user's grants. Returns false if it isn't theirs. */
export async function revokeConnectedApp(
  db: Database,
  userId: number,
  grantId: string,
): Promise<boolean> {
  const result = await db
    .update(oauthGrants)
    .set({ revoked_at: new Date().toISOString() })
    .where(
      and(
        eq(oauthGrants.id, grantId),
        eq(oauthGrants.user_id, userId),
        isNull(oauthGrants.revoked_at),
      ),
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}
