import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { DELETE } from '../../../../../src/app/api/sessions/self/route';
import { SESSION_COOKIE } from '../../../../../src/lib/auth/session';
import { fromApp, openWorld, type World } from '../../world';

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('DELETE /api/sessions/self', () => {
  it('clears the session cookie and answers 204', async () => {
    const res = await DELETE(fromApp('DELETE', '/api/sessions/self'));
    expect(res.status).toBe(204);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toMatch(/expires=Thu, 01 Jan 1970/i);
  });

  it('is idempotent: signing out when already signed out is fine', async () => {
    expect((await DELETE(fromApp('DELETE', '/api/sessions/self'))).status).toBe(
      204,
    );
    expect((await DELETE(fromApp('DELETE', '/api/sessions/self'))).status).toBe(
      204,
    );
  });

  it('answers 403 for a request from another site, and clears nothing', async () => {
    const res = await DELETE(
      fromApp('DELETE', '/api/sessions/self', {
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('answers 403 for a foreign Origin when the browser sent no Fetch Metadata', async () => {
    const res = await DELETE(
      new Request('https://chowdown.test/api/sessions/self', {
        method: 'DELETE',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(res.status).toBe(403);
  });
});
