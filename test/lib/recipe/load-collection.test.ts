import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '../../../src/lib/auth/drive-access';
import type { SessionPayload } from '../../../src/lib/auth/session';
import type { Database } from '../../../src/lib/db/client';
import type { AppPageRows } from '../../../src/lib/db/recipe-page';
import {
  loadCollection,
  type CollectionDeps,
} from '../../../src/lib/recipe/load-collection';

const db = {} as Database;

/** What a mocked collaborator looks like to `expect`, without dragging the database's deep types into the comparison. */
type Calls = jest.Mock<(...args: readonly unknown[]) => Promise<unknown>>;

/** Thrown by the fake redirect so a test can see where it went. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

/** A signed-in session whose Drive hint can be set. */
const session = (drive: boolean | undefined = true) =>
  ({ uid: 1, email: 'a@b.c', drive }) as SessionPayload;

/** Page rows for a user with the given token, recipes and embedding count. */
function rows(
  options: {
    token?: string | null;
    folder?: string | null;
    recipes?: number;
    embedded?: number;
    user?: boolean;
  } = {},
): AppPageRows {
  const { token = 'sealed', folder = 'folder', recipes = 2 } = options;
  return {
    user:
      options.user === false
        ? undefined
        : ({
            id: 1,
            refresh_token_enc: token,
            recipes_folder_id: folder,
          } as AppPageRows['user']),
    recipes: Array.from({ length: recipes }, (_, i) => ({
      drive_file_id: `r${i}`,
    })) as unknown as AppPageRows['recipes'],
    embeddedCount: options.embedded ?? recipes,
    favouriteIds: ['r0'],
  };
}

/** Fake collaborators; `reads` are the successive answers of the page query. */
function fakes(
  reads: readonly AppPageRows[],
  overrides: Partial<CollectionDeps> = {},
) {
  const background: Promise<unknown>[] = [];
  const pageRows = jest.fn<CollectionDeps['pageRows']>();
  reads.forEach((read) => pageRows.mockResolvedValueOnce(read));
  const deps: CollectionDeps = {
    session: async () => session(),
    database: () => db,
    pageRows,
    sync: jest.fn(async () => undefined),
    backfill: jest.fn(async () => undefined),
    background: (work) => {
      background.push(work);
    },
    redirect: (to) => {
      throw new Redirected(to);
    },
    ...overrides,
  };
  return { deps, background, pageRows };
}

describe('loadCollection', () => {
  it('sends someone signed out home', async () => {
    const { deps } = fakes([], { session: async () => null });
    await expect(loadCollection('/app', deps)).rejects.toMatchObject({
      to: '/',
    });
  });

  it('starts over when the account is gone', async () => {
    const { deps } = fakes([rows({ user: false })]);
    await expect(loadCollection('/app', deps)).rejects.toMatchObject({
      to: '/',
    });
  });

  it('shows the cache and refreshes from Drive in the background', async () => {
    const { deps, background } = fakes([rows()]);
    const collection = await loadCollection('/app', deps);
    expect(collection.recipes).toHaveLength(2);
    expect(collection.favouriteIds).toEqual(['r0']);
    expect(collection.drive).toEqual({
      connected: true,
      reconnect: false,
      unreachable: false,
    });
    expect(deps.sync).toHaveBeenCalledTimes(1);
    expect(background).toHaveLength(1);
    expect(deps.backfill).not.toHaveBeenCalled();
  });

  it('tops up missing embeddings in the background, a few at a time', async () => {
    const { deps, background } = fakes([rows({ recipes: 3, embedded: 1 })]);
    await loadCollection('/app', deps);
    expect(deps.backfill as unknown as Calls).toHaveBeenCalledWith(db, 1, 20);
    expect(background).toHaveLength(2);
  });

  it('syncs and waits on a first visit, then reads again', async () => {
    const { deps, background, pageRows } = fakes([
      rows({ recipes: 0 }),
      rows({ recipes: 3 }),
    ]);
    const collection = await loadCollection('/app', deps);
    expect(deps.sync).toHaveBeenCalledTimes(1);
    expect(pageRows).toHaveBeenCalledTimes(2);
    expect(collection.recipes).toHaveLength(3);
    // Waited for inline, so the sync is not also queued for later.
    expect(background).toHaveLength(0);
  });

  it('reports Drive unreachable when a first sync fails for a passing reason', async () => {
    const { deps } = fakes([rows({ recipes: 0 }), rows({ recipes: 0 })], {
      sync: async () => {
        throw new Error('network blip');
      },
    });
    const collection = await loadCollection('/app', deps);
    expect(collection.drive).toEqual({
      connected: true,
      reconnect: false,
      unreachable: true,
    });
  });

  it('asks to reconnect when Google rejected the login during a first sync', async () => {
    const { deps } = fakes([rows({ recipes: 0 }), rows({ recipes: 0 })], {
      session: async () => session(false),
      sync: async () => {
        throw new DriveNotConnectedError();
      },
    });
    const collection = await loadCollection('/app', deps);
    expect(collection.drive).toEqual({
      connected: false,
      reconnect: true,
      unreachable: false,
    });
  });

  it('does not sync for someone who never connected Drive', async () => {
    const { deps } = fakes([rows({ token: null, folder: null })], {
      session: async () => session(false),
    });
    const collection = await loadCollection('/app', deps);
    expect(deps.sync).not.toHaveBeenCalled();
    expect(collection.drive).toEqual({
      connected: false,
      reconnect: false,
      unreachable: false,
    });
  });

  it('reissues the session through a route when its Drive hint is stale', async () => {
    const { deps } = fakes([rows()], { session: async () => session(false) });
    await expect(loadCollection('/app/home?x=1', deps)).rejects.toMatchObject({
      to: '/api/auth/refresh?returnTo=%2Fapp%2Fhome%3Fx%3D1',
    });
  });
});
