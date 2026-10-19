import { describe, expect, it, jest } from '@jest/globals';

import {
  createOAuthStore,
  listConnectedApps,
  resolveClient,
  revokeConnectedApp,
  saveClient,
} from '../../../src/lib/db/oauth';
import { fakeDb } from './fake-db';

const CIMD = 'https://app.example/client.json';

/** A registry row for a client. */
const row = (overrides: Record<string, unknown> = {}) => ({
  client_id: 'dcr_abc',
  kind: 'dcr',
  client_name: 'Assistant',
  redirect_uris: '["https://app.example/cb"]',
  created_at: '2026-01-01T00:00:00.000Z',
  fetched_at: null,
  ...overrides,
});

/** A fetch that serves a valid metadata document for `CIMD`. */
const serving = jest.fn(
  async () =>
    new Response(
      JSON.stringify({
        client_id: CIMD,
        client_name: 'Fresh',
        redirect_uris: ['https://app.example/cb'],
      }),
    ),
) as unknown as typeof fetch;

describe('resolveClient', () => {
  it('reads a registered client straight from the registry', async () => {
    const { db } = fakeDb({ findFirst: { oauthClients: row() } });
    expect(await resolveClient(db, 'dcr_abc')).toEqual({
      clientId: 'dcr_abc',
      name: 'Assistant',
      redirectUris: ['https://app.example/cb'],
      kind: 'dcr',
    });
  });

  it('does not know a plain id that was never registered', async () => {
    const { db } = fakeDb({ findFirst: { oauthClients: undefined } });
    expect(await resolveClient(db, 'dcr_nope')).toBeUndefined();
  });

  it('trusts a recently fetched metadata document without fetching again', async () => {
    const fetchImpl = jest.fn(serving);
    const { db } = fakeDb({
      findFirst: {
        oauthClients: row({
          client_id: CIMD,
          kind: 'cimd',
          fetched_at: new Date().toISOString(),
        }),
      },
    });
    const client = await resolveClient(db, CIMD, fetchImpl);
    expect(client?.kind).toBe('cimd');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches and saves a metadata document it has not seen', async () => {
    const { db, calls } = fakeDb({ findFirst: { oauthClients: undefined } });
    const client = await resolveClient(db, CIMD, serving);
    expect(client).toMatchObject({
      clientId: CIMD,
      name: 'Fresh',
      kind: 'cimd',
    });
    expect(calls.filter((c) => c.statement === 'insert')).not.toHaveLength(0);
  });

  it('refreshes a stale document', async () => {
    const { db } = fakeDb({
      findFirst: {
        oauthClients: row({
          client_id: CIMD,
          kind: 'cimd',
          client_name: 'Old',
          fetched_at: '2020-01-01T00:00:00.000Z',
        }),
      },
    });
    expect((await resolveClient(db, CIMD, serving))?.name).toBe('Fresh');
  });

  it('keeps using a stale copy when the client is briefly down', async () => {
    const down = jest.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    const { db } = fakeDb({
      findFirst: {
        oauthClients: row({
          client_id: CIMD,
          kind: 'cimd',
          client_name: 'Old',
          fetched_at: '2020-01-01T00:00:00.000Z',
        }),
      },
    });
    expect((await resolveClient(db, CIMD, down))?.name).toBe('Old');
  });

  it('does not know a metadata document it cannot fetch and never saw', async () => {
    const down = jest.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    const { db } = fakeDb({ findFirst: { oauthClients: undefined } });
    expect(await resolveClient(db, CIMD, down)).toBeUndefined();
  });
});

describe('saveClient', () => {
  it('stores the client and stamps when a metadata document was fetched', async () => {
    const { db, calls } = fakeDb();
    await saveClient(db, {
      clientId: CIMD,
      name: 'Fresh',
      redirectUris: ['https://app.example/cb'],
      kind: 'cimd',
    });
    const values = calls.find((c) => c.method === 'values')?.args[0];
    expect(values).toMatchObject({
      client_id: CIMD,
      kind: 'cimd',
      redirect_uris: '["https://app.example/cb"]',
    });
    expect((values as { fetched_at: unknown }).fetched_at).toEqual(
      expect.any(String),
    );
  });

  it('leaves fetched_at empty for a registered client', async () => {
    const { db, calls } = fakeDb();
    await saveClient(db, {
      clientId: 'dcr_x',
      name: 'X',
      redirectUris: [],
      kind: 'dcr',
    });
    expect(
      (
        calls.find((c) => c.method === 'values')?.args[0] as {
          fetched_at: unknown;
        }
      ).fetched_at,
    ).toBeNull();
  });
});

describe('createOAuthStore', () => {
  it('finds a code and splits its scope', async () => {
    const { db } = fakeDb({
      findFirst: {
        oauthCodes: {
          client_id: 'c',
          user_id: 7,
          redirect_uri: 'https://app.example/cb',
          code_challenge: 'ch',
          scope: 'recipes:read recipes:write',
          resource: 'r',
          expires_at: 99,
          grant_id: null,
        },
      },
    });
    expect(await createOAuthStore(db).findCode('h')).toEqual({
      clientId: 'c',
      userId: 7,
      redirectUri: 'https://app.example/cb',
      codeChallenge: 'ch',
      scope: ['recipes:read', 'recipes:write'],
      resource: 'r',
      expiresAt: 99,
      grantId: null,
    });
  });

  it('knows no code that is not stored', async () => {
    const { db } = fakeDb({ findFirst: { oauthCodes: undefined } });
    expect(await createOAuthStore(db).findCode('h')).toBeUndefined();
  });

  it('claims a code only when a row actually changed', async () => {
    expect(
      await createOAuthStore(
        fakeDb({ update: [{ meta: { changes: 1 } }] }).db,
      ).claimCode('h', 'g'),
    ).toBe(true);
    expect(
      await createOAuthStore(
        fakeDb({ update: [{ meta: { changes: 0 } }] }).db,
      ).claimCode('h', 'g'),
    ).toBe(false);
  });

  it('saves each token separately', async () => {
    const { db, calls } = fakeDb();
    await createOAuthStore(db).saveTokens([
      { hash: 'a', kind: 'access', grantId: 'g', expiresAt: 1 },
      { hash: 'b', kind: 'refresh', grantId: 'g', expiresAt: 2 },
    ]);
    expect(
      calls.filter((c) => c.method === 'values').map((c) => c.args[0]),
    ).toEqual([
      { token_hash: 'a', kind: 'access', grant_id: 'g', expires_at: 1 },
      { token_hash: 'b', kind: 'refresh', grant_id: 'g', expires_at: 2 },
    ]);
  });

  it('finds a token with its grant', async () => {
    const { db } = fakeDb({
      select: [
        [
          {
            token: { kind: 'refresh', expires_at: 5, used_at: null },
            grant: {
              id: 'g',
              user_id: 7,
              client_id: 'c',
              scope: 'recipes:read',
              resource: 'r',
              revoked_at: null,
              last_used_at: '1970-01-01T00:16:40.000Z',
            },
          },
        ],
      ],
    });
    expect(await createOAuthStore(db).findToken('h')).toEqual({
      kind: 'refresh',
      expiresAt: 5,
      usedAt: null,
      grant: {
        id: 'g',
        userId: 7,
        clientId: 'c',
        scope: ['recipes:read'],
        resource: 'r',
        revoked: false,
        lastUsedAt: 1000,
      },
    });
  });

  it('reads a revoked grant and a never-used one', async () => {
    const { db } = fakeDb({
      select: [
        [
          {
            token: { kind: 'access', expires_at: 5, used_at: 3 },
            grant: {
              id: 'g',
              user_id: 7,
              client_id: 'c',
              scope: 'recipes:read',
              resource: 'r',
              revoked_at: '2026-01-01T00:00:00.000Z',
              last_used_at: null,
            },
          },
        ],
      ],
    });
    expect(await createOAuthStore(db).findToken('h')).toMatchObject({
      kind: 'access',
      usedAt: 3,
      grant: { revoked: true, lastUsedAt: null },
    });
  });

  it('knows no token that is not stored', async () => {
    const { db } = fakeDb({ select: [[]] });
    expect(await createOAuthStore(db).findToken('h')).toBeUndefined();
  });

  it('marks a token used only when a row actually changed', async () => {
    expect(
      await createOAuthStore(
        fakeDb({ update: [{ meta: { changes: 1 } }] }).db,
      ).markTokenUsed('h', 5),
    ).toBe(true);
    expect(
      await createOAuthStore(
        fakeDb({ update: [{ meta: { changes: 0 } }] }).db,
      ).markTokenUsed('h', 5),
    ).toBe(false);
  });

  it('records when a grant was last used, as a timestamp', async () => {
    const { db, calls } = fakeDb();
    await createOAuthStore(db).touchGrant('g', 1000);
    expect(calls.find((c) => c.method === 'set')?.args[0]).toEqual({
      last_used_at: '1970-01-01T00:16:40.000Z',
    });
  });
});

describe('listConnectedApps', () => {
  it('names each app, falling back to its client id', async () => {
    const grant = {
      id: 'g1',
      client_id: 'dcr_abc',
      scope: 'recipes:read recipes:write',
      created_at: '2026-01-01T00:00:00.000Z',
      last_used_at: null,
    };
    const { db } = fakeDb({
      select: [
        [
          { grant, name: 'Claude' },
          { grant: { ...grant, id: 'g2' }, name: null },
        ],
      ],
    });
    expect(await listConnectedApps(db, 7)).toEqual([
      {
        grantId: 'g1',
        name: 'Claude',
        scope: ['recipes:read', 'recipes:write'],
        connectedAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
      },
      expect.objectContaining({ grantId: 'g2', name: 'dcr_abc' }),
    ]);
  });
});

describe('revokeConnectedApp', () => {
  it('says whether the user had such a grant', async () => {
    expect(
      await revokeConnectedApp(
        fakeDb({ update: [{ meta: { changes: 1 } }] }).db,
        7,
        'g',
      ),
    ).toBe(true);
    expect(
      await revokeConnectedApp(
        fakeDb({ update: [{ meta: { changes: 0 } }] }).db,
        7,
        'g',
      ),
    ).toBe(false);
  });
});
