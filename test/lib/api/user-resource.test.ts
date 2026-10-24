import { describe, expect, it } from '@jest/globals';

import type { User } from '@/lib/db/users';
import { parseUserPatch, userResource } from '@/lib/api/user-resource';

const user = (extra: Partial<User> = {}) =>
  ({
    id: 7,
    email: 'a@b.com',
    name: 'Ann',
    picture: 'https://x/p.png',
    units: 'metric',
    ...extra,
  }) as User;

describe('userResource', () => {
  it('shows identity and the measurement system in API form', () => {
    expect(userResource(user())).toEqual({
      id: '7',
      email: 'a@b.com',
      name: 'Ann',
      picture_url: 'https://x/p.png',
      measurement_system: 'METRIC',
    });
  });

  it('omits what is not set', () => {
    expect(
      userResource(user({ name: null, picture: null, units: null })),
    ).toEqual({
      id: '7',
      email: 'a@b.com',
    });
  });

  it('ignores a stored value it does not know', () => {
    expect(
      userResource(user({ units: 'furlongs' })).measurement_system,
    ).toBeUndefined();
  });
});

describe('parseUserPatch', () => {
  it('stores the system in lower case, or clears it with null', () => {
    expect(parseUserPatch({ measurement_system: 'US' })).toEqual({
      ok: true,
      units: 'us',
    });
    expect(parseUserPatch({ measurement_system: null })).toEqual({
      ok: true,
      units: null,
    });
  });

  it('has nothing to store when the patch does not mention the system', () => {
    expect(parseUserPatch({})).toEqual({ ok: true, units: null });
  });

  it('refuses unknown values and read-only fields', () => {
    expect(parseUserPatch({ measurement_system: 'metric' }).ok).toBe(false);
    const result = parseUserPatch({ email: 'x@y.com' });
    expect(result).toEqual({
      ok: false,
      errors: [expect.stringContaining('email')],
    });
  });
});
