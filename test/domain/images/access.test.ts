import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import {
  authenticate,
  mayFetch,
  signatureFor,
  signatureValid,
} from '@/domain/images/access';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. Injected in place of the session cookie. */
const session: { uid: number | null } = { uid: 7 };
const sessionUid = async (): Promise<number | null> => session.uid;

const PHOTO = 'https://photos.example.org/soup.jpg';
const UNLISTED = 'https://photos.example.org/unlisted.jpg';
const LOGO = 'https://apps.example.org/logo.png';

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw.exec(
    `INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at, logo_uri) VALUES ('https://apps.example.org/c.json', 'cimd', 'App', '[]', 't', '${LOGO}')`,
  );
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
    expect(await authenticate(undefined, sessionUid)).toBeUndefined();
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await authenticate(undefined, sessionUid))?.status).toBe(401);
  });
});

describe('mayFetch', () => {
  it('lets a person have a photo one of their recipes lists', async () => {
    expect(await mayFetch(PHOTO, sessionUid)).toBe(true);
  });

  it('refuses a photo none of their recipes lists', async () => {
    expect(await mayFetch(UNLISTED, sessionUid)).toBe(false);
  });

  it("refuses a photo only someone else's recipe lists", async () => {
    session.uid = 8;
    expect(await mayFetch(PHOTO, sessionUid)).toBe(false);
  });

  it('lets a person have the logo of an app they have connected', async () => {
    raw.exec(
      "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES ('g1', 7, 'https://apps.example.org/c.json', 'recipes:read', 'r', 't')",
    );
    expect(await mayFetch(LOGO, sessionUid)).toBe(true);
    session.uid = 8;
    expect(await mayFetch(LOGO, sessionUid)).toBe(false);
  });

  it('refuses the logo of an app they have not connected, or have disconnected', async () => {
    expect(await mayFetch(LOGO, sessionUid)).toBe(false);
    raw.exec(
      "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at, revoked_at) VALUES ('g1', 7, 'https://apps.example.org/c.json', 'recipes:read', 'r', 't', 't')",
    );
    expect(await mayFetch(LOGO, sessionUid)).toBe(false);
  });

  it('refuses everything when nobody is signed in', async () => {
    session.uid = null;
    expect(await mayFetch(PHOTO, sessionUid)).toBe(false);
  });
});

describe('signatures', () => {
  it('are not used: who may ask is decided by the recipes', async () => {
    expect(signatureFor()).toBeUndefined();
    await expect(signatureValid()).resolves.toBe(true);
  });
});
