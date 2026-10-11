import { describe, expect, it } from '@jest/globals';

import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from '../../../src/lib/auth/session';

const SECRET = 'test-session-secret-value';

describe('session tokens', () => {
  it('round-trips a valid session', async () => {
    const token = await createSessionToken({ uid: 42, email: 'a@b.com' }, SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload?.uid).toBe(42);
    expect(payload?.email).toBe('a@b.com');
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken({ uid: 1, email: 'x@y.com' }, SECRET);
    const [, sig] = token.split('.');
    const forged = `${btoa('{"uid":999,"email":"evil@z.com","exp":9999999999}')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')}.${sig}`;
    expect(await verifySessionToken(forged, SECRET)).toBeNull();
  });

  it('rejects the wrong secret', async () => {
    const token = await createSessionToken({ uid: 1, email: 'x@y.com' }, SECRET);
    expect(await verifySessionToken(token, 'other-secret')).toBeNull();
  });

  it('rejects an expired session', async () => {
    const token = await createSessionToken(
      { uid: 1, email: 'x@y.com', exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('defaults expiry to the configured TTL', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createSessionToken({ uid: 1, email: 'x@y.com' }, SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload!.exp).toBeGreaterThanOrEqual(before + SESSION_TTL_SECONDS - 5);
  });
});
