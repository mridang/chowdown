import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { APP_MIGRATIONS } from '../db/migrations';
import { installCloudflareContext, sqliteD1 } from '../db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

jest.unstable_mockModule('../../../src/lib/auth/current-user', () => ({
  getSessionUid: async () => session.uid,
}));

const { authenticate, mayFetch, signatureFor, signatureValid } =
  await import('@/lib/images/access');

const PHOTO = 'https://photos.example.org/soup.jpg';
const UNLISTED = 'https://photos.example.org/unlisted.jpg';

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw.exec(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 's7', 'a@b.c', 't', 't'), (8, 's8', 'd@e.f', 't', 't')",
  );
  const insert = raw.prepare(
    "INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (?, ?, ?, ?, 't', 't')",
  );
  insert.run(
    7,
    'f1',
    'Soup.cook',
    `>> title: Soup\n>> images: ${PHOTO}\n\nBoil.`,
  );
  insert.run(
    8,
    'f2',
    'Stew.cook',
    `>> title: Stew\n>> images: ${UNLISTED}\n\nBoil.`,
  );
});

afterEach(() => {
  restore();
});

describe('authenticate', () => {
  it('lets a signed-in person go on', async () => {
    expect(await authenticate()).toBeUndefined();
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await authenticate())?.status).toBe(401);
  });
});

describe('mayFetch', () => {
  it('lets a person have a photo one of their recipes lists', async () => {
    expect(await mayFetch(PHOTO)).toBe(true);
  });

  it('refuses a photo none of their recipes lists', async () => {
    expect(await mayFetch(UNLISTED)).toBe(false);
  });

  it("refuses a photo only someone else's recipe lists", async () => {
    session.uid = 8;
    expect(await mayFetch(PHOTO)).toBe(false);
  });

  it('refuses everything when nobody is signed in', async () => {
    session.uid = null;
    expect(await mayFetch(PHOTO)).toBe(false);
  });
});

describe('signatures', () => {
  it('are not used: who may ask is decided by the recipes', () => {
    expect(signatureFor()).toBeUndefined();
    expect(signatureValid()).toBe(true);
  });
});
