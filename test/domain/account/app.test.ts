import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { afterAccountDeleted } from '@/domain/account/app';
import { getUserAccessToken } from '@/domain/auth/user-access-token';
import { getDatabase } from '@/domain/db/client';
import { getUserById, type User } from '@/domain/db/users';
import { settleBackground } from '../../lib/core/db/sqlite-d1';
import {
  addRecipe,
  fakeGoogle,
  openWorld,
  signIn,
  type GoogleFake,
  type World,
} from '../../app/api/world';

let world: World;
let google: GoogleFake;
let person: User;

beforeEach(async () => {
  world = openWorld();
  const uid = await signIn(world, { drive: true });
  addRecipe(world, uid, 'f1', '>> title: A\n');
  google = fakeGoogle({ f1: { name: 'A.cook', content: '>> title: A\n' } });
  const found = await getUserById(getDatabase(), uid);
  if (!found) {
    throw new Error('the person was not signed in');
  }
  person = found;
});

afterEach(() => world.close());

/** Delete-time tidying for the person, with its background work finished. */
async function tidy(): Promise<void> {
  afterAccountDeleted(person);
  await settleBackground();
}

/** How many times Google was asked for an access token. */
const tokenRequests = () =>
  google.requests.filter((r) => r.includes('oauth2.googleapis.com/token'))
    .length;

describe('afterAccountDeleted', () => {
  it('gives the Drive login back to Google', async () => {
    await tidy();
    expect(google.requests).toContain(
      'POST https://oauth2.googleapis.com/revoke',
    );
  });

  it("leaves the person's files in their own Google Drive alone", async () => {
    await tidy();
    expect(google.files.has('f1')).toBe(true);
  });

  it("changes nothing in the person's Google Drive", async () => {
    await tidy();
    expect(google.requests.some((r) => r.startsWith('PATCH'))).toBe(false);
  });

  it('forgets the Google access token it held for the person', async () => {
    await getUserAccessToken(person);
    await tidy();
    await getUserAccessToken(person);
    expect(tokenRequests()).toBe(2);
  });
});
