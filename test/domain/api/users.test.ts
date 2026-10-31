import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { fakeCookies } from '../auth/session-fixture';
import { fromApp, openWorld, signIn, type World } from '../../app/api/world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { userSelf } = await import('@/domain/api/users');
const { GET, PATCH } = userSelf.handlers();

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('GET /api/users/self', () => {
  it('answers the profile, in API form', async () => {
    await signIn(world, { email: 'ada@example.com' });
    const res = await GET(fromApp('GET', '/api/users/self'));
    expect(await res.json()).toEqual({ id: '1', email: 'ada@example.com' });
  });
});

describe('PATCH /api/users/self', () => {
  const patch = (json: unknown, type = 'application/merge-patch+json') =>
    PATCH(fromApp('PATCH', '/api/users/self', { json, type }));

  it('answers 401 when nobody is signed in', async () => {
    expect((await patch({ measurement_system: 'US' })).status).toBe(401);
  });

  it('answers 403 for a request from another site', async () => {
    await signIn(world);
    const res = await PATCH(
      fromApp('PATCH', '/api/users/self', {
        json: {},
        type: 'application/merge-patch+json',
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('sets the measurement system with a merge patch', async () => {
    await signIn(world);
    const res = await patch({ measurement_system: 'US' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ measurement_system: 'US' });
    expect(world.raw.prepare('SELECT units FROM users').get()).toEqual({
      units: 'us',
    });
  });

  it('clears it with null', async () => {
    await signIn(world);
    await patch({ measurement_system: 'METRIC' });
    const res = await patch({ measurement_system: null });
    expect((await res.json()) as object).not.toHaveProperty(
      'measurement_system',
    );
    expect(world.raw.prepare('SELECT units FROM users').get()).toEqual({
      units: null,
    });
  });

  it('accepts plain JSON as well', async () => {
    await signIn(world);
    expect(
      (await patch({ measurement_system: 'IMPERIAL' }, 'application/json'))
        .status,
    ).toBe(200);
  });

  it('answers 415 for another media type', async () => {
    await signIn(world);
    expect((await patch({}, 'text/plain')).status).toBe(415);
  });

  it('answers 400 for a patch that is not an object', async () => {
    await signIn(world);
    expect((await patch([])).status).toBe(400);
  });

  it('answers 400 for a value that is not allowed', async () => {
    await signIn(world);
    expect((await patch({ measurement_system: 'FURLONGS' })).status).toBe(400);
  });

  it('answers 400 for a field that cannot be edited, and changes nothing', async () => {
    await signIn(world);
    expect((await patch({ email: 'new@example.com' })).status).toBe(400);
    expect(world.raw.prepare('SELECT email FROM users').get()).toEqual({
      email: 'user1@example.com',
    });
  });
});
