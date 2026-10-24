import { describe, expect, it } from '@jest/globals';

import {
  ENDED_SESSION_PATH,
  EXTRA_PURPOSES,
  driveHint,
  folderHint,
  sessionClaims,
} from '@/lib/auth/app';
import { createSessionToken, verifySessionToken } from '@/lib/session';

const SECRET = 'test-session-secret-value';

describe('sessionClaims', () => {
  it('says whether Drive is connected, from the stored login', () => {
    const none = { refresh_token_enc: null, recipes_folder_id: null };
    expect(sessionClaims(none)).toEqual({ drive: false });
    expect(sessionClaims({ ...none, refresh_token_enc: 'sealed' })).toEqual({
      drive: true,
    });
  });

  it('can be told Drive has just been connected, though the record is from before', () => {
    expect(
      sessionClaims({ refresh_token_enc: null, recipes_folder_id: null }, true),
    ).toEqual({ drive: true });
  });

  it('carries the Recipes folder, so the header can open it, and leaves it out when there is none', () => {
    expect(
      sessionClaims({ refresh_token_enc: null, recipes_folder_id: 'folder-1' }),
    ).toEqual({ drive: false, folder: 'folder-1' });
    expect(
      sessionClaims({ refresh_token_enc: null, recipes_folder_id: null }),
    ).not.toHaveProperty('folder');
  });

  it('survives a trip through a session token', async () => {
    const claims = sessionClaims({
      refresh_token_enc: 'x',
      recipes_folder_id: '1AbC-dEf_9',
    });
    const payload = await verifySessionToken(
      await createSessionToken({ uid: 1, email: 'a@b.com', ...claims }, SECRET),
      SECRET,
    );
    expect(payload && driveHint(payload)).toBe(true);
    expect(payload && folderHint(payload)).toBe('1AbC-dEf_9');
  });
});

describe('driveHint and folderHint', () => {
  const session = (claims: Record<string, string | number | boolean>) => ({
    uid: 1,
    email: 'a@b.com',
    exp: 1,
    ...claims,
  });

  it('read what the session says', () => {
    expect(driveHint(session({ drive: false }))).toBe(false);
    expect(folderHint(session({ folder: 'f' }))).toBe('f');
  });

  it('are undefined for a session issued before the hints existed', () => {
    expect(driveHint(session({}))).toBeUndefined();
    expect(folderHint(session({}))).toBeUndefined();
  });

  it('ignore a claim of the wrong type', () => {
    expect(driveHint(session({ drive: 'yes' }))).toBeUndefined();
    expect(folderHint(session({ folder: 7 }))).toBeUndefined();
  });
});

describe('the rest of the app’s sign-in settings', () => {
  it('has Drive as the one extra ask a Google round trip can be for', () => {
    expect(EXTRA_PURPOSES).toEqual(['drive']);
  });

  it('names the route that clears a dead session', () => {
    expect(ENDED_SESSION_PATH).toBe('/auth/refresh');
  });
});
