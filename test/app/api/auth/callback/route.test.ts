import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  SESSION_COOKIE,
  verifySessionToken,
} from '../../../../../src/lib/auth/session';
import { decryptSecret } from '../../../../../src/lib/crypto';
import {
  SESSION_SECRET,
  sessionTokenFor,
} from '../../../../lib/auth/session-fixture';
import {
  answerFetch,
  locationOf,
  nextRequest,
  openWorld,
  signIn,
  type World,
} from '../../world';

const { GET } = await import('../../../../../src/app/api/auth/callback/route');

let world: World;

beforeEach(() => {
  world = openWorld();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => world.close());

const STATE = 'signin.abc';
const DRIVE_STATE = 'drive.abc';

/** The cookies a browser holds partway through a round trip. */
const trip = (state = STATE, extra: Record<string, string> = {}) => ({
  chowdown_oauth_state: state,
  ...extra,
});

/** A callback request from Google. */
const callback = (query: string, cookies: Record<string, string> = trip()) =>
  GET(nextRequest(`/api/auth/callback?${query}`, cookies));

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const DRIVE_URL = 'https://www.googleapis.com/drive/v3/files';

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

/** Google answering a successful sign-in for `sub`. */
function googleSignsIn(
  sub = 'google-sub-1',
  email: string | null = 'ada@example.com',
) {
  return answerFetch({
    [TOKEN_URL]: () => json({ access_token: 'at', expires_in: 3599 }),
    [USERINFO_URL]: () =>
      json({ sub, ...(email === null ? {} : { email }), name: 'Ada Lovelace' }),
  });
}

/** Everything the callback set on the response, by cookie name. */
const cookiesOf = (res: Awaited<ReturnType<typeof callback>>) =>
  Object.fromEntries(res.cookies.getAll().map((c) => [c.name, c.value]));

describe('GET /api/auth/callback with a state that does not check out', () => {
  it('sends a sign-in back with a fixed flag when there is no state cookie', async () => {
    const res = await callback(`code=c&state=${STATE}`, {});
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
  });

  it('sends it back when the state differs from the cookie', async () => {
    const res = await callback(`code=c&state=signin.other`);
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
  });

  it('sends a Drive round trip back to the list with an error flag', async () => {
    const res = await callback(`code=c&state=drive.other`, trip(DRIVE_STATE));
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app?drive=error');
  });

  it('never calls Google and leaves the cookies of a real round trip alone', async () => {
    const requested = answerFetch({});
    const res = await callback(`code=c&state=signin.forged`);
    expect(requested).toEqual([]);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

describe('GET /api/auth/callback when the person did not approve', () => {
  it('sends a cancelled sign-in back with a fixed flag and clears the round-trip cookies', async () => {
    const res = await callback(`error=access_denied&state=${STATE}`);
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
    expect(res.headers.get('set-cookie')).toContain('chowdown_oauth_state=;');
  });

  it('sends a cancelled Drive connection back as denied', async () => {
    const res = await callback(
      `error=access_denied&state=${DRIVE_STATE}`,
      trip(DRIVE_STATE),
    );
    expect(locationOf(res)?.href).toBe(
      'https://chowdown.test/app?drive=denied',
    );
  });
});

describe('GET /api/auth/callback signing in', () => {
  it('creates the person, issues a signed session and lands on /app', async () => {
    googleSignsIn();
    const res = await callback(`code=c&state=${STATE}`);
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app');
    const row = world.raw
      .prepare('SELECT id, email, google_sub FROM users')
      .get();
    expect(row).toEqual({
      id: 1,
      email: 'ada@example.com',
      google_sub: 'google-sub-1',
    });
    const session = await verifySessionToken(
      cookiesOf(res)[SESSION_COOKIE] ?? '',
      SESSION_SECRET,
    );
    expect(session).toMatchObject({
      uid: 1,
      email: 'ada@example.com',
      drive: false,
      ep: 0,
    });
  });

  it('sets a cookie that is httpOnly, Lax and Secure on https', async () => {
    googleSignsIn();
    const res = await callback(`code=c&state=${STATE}`);
    expect(res.cookies.get(SESSION_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });
  });

  it('clears the one-time cookies once the trip is over', async () => {
    googleSignsIn();
    const res = await callback(`code=c&state=${STATE}`);
    const header = res.headers.get('set-cookie') ?? '';
    expect(header).toContain('chowdown_oauth_state=;');
    expect(header).toContain('chowdown_return_to=;');
  });

  it('lands on the safe returnTo the trip began with', async () => {
    googleSignsIn();
    const res = await callback(
      `code=c&state=${STATE}`,
      trip(STATE, { chowdown_return_to: '/recipe/abc' }),
    );
    expect(locationOf(res)?.href).toBe('https://chowdown.test/recipe/abc');
  });

  it('ignores a returnTo cookie that points off the site', async () => {
    googleSignsIn();
    const res = await callback(
      `code=c&state=${STATE}`,
      trip(STATE, { chowdown_return_to: '//evil.example' }),
    );
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app');
  });

  it('recognises a returning person by their Google id and carries their epoch', async () => {
    googleSignsIn('google-sub-1', 'new-address@example.com');
    world.raw
      .prepare(
        "INSERT INTO users (id, google_sub, email, session_epoch, created_at, updated_at) VALUES (4, 'google-sub-1', 'old@example.com', 7, 'n', 'n')",
      )
      .run();
    const res = await callback(`code=c&state=${STATE}`);
    const session = await verifySessionToken(
      cookiesOf(res)[SESSION_COOKIE] ?? '',
      SESSION_SECRET,
    );
    expect(session).toMatchObject({ uid: 4, ep: 7 });
    expect(world.raw.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: 1,
    });
  });

  it('fails the sign-in when Google shares no email address', async () => {
    googleSignsIn('google-sub-1', null);
    const res = await callback(`code=c&state=${STATE}`);
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it('fails the sign-in, showing nothing Google said, when the code is refused', async () => {
    answerFetch({ [TOKEN_URL]: () => json({ error: 'invalid_grant' }, 400) });
    const res = await callback(`code=bad&state=${STATE}`);
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(world.raw.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: 0,
    });
  });
});

describe('GET /api/auth/callback connecting Drive', () => {
  /** Google approving the Drive connection for `sub`, with or without the Drive permission. */
  function googleConnects(
    options: { sub?: string; scope?: string; refresh?: boolean } = {},
  ) {
    return answerFetch({
      [TOKEN_URL]: () =>
        json({
          access_token: 'at',
          expires_in: 3599,
          scope:
            options.scope ??
            'openid https://www.googleapis.com/auth/drive.file',
          ...(options.refresh === false
            ? {}
            : { refresh_token: 'the-refresh-token' }),
        }),
      [USERINFO_URL]: () => json({ sub: options.sub ?? 'sub-1' }),
      [DRIVE_URL]: (init) =>
        init?.method === 'POST'
          ? json({ id: 'new-folder' })
          : json({ files: [] }),
    });
  }

  const connect = (cookies: Record<string, string> = {}) =>
    callback(`code=c&state=${DRIVE_STATE}`, trip(DRIVE_STATE, cookies));

  it('seals the refresh token, makes the folder, and reissues the session with Drive on', async () => {
    await signIn(world);
    const soon = Math.floor(Date.now() / 1000) + 3600;
    googleConnects();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }, { exp: soon }),
    });
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app');
    const row = world.raw
      .prepare(
        'SELECT refresh_token_enc AS t, recipes_folder_id AS f FROM users',
      )
      .get();
    expect(row?.['f']).toBe('new-folder');
    expect(row?.['t']).not.toContain('the-refresh-token');
    expect(
      await decryptSecret(
        String(row?.['t']),
        String(world.env['TOKEN_ENCRYPTION_KEY']),
      ),
    ).toBe('the-refresh-token');
    const session = await verifySessionToken(
      cookiesOf(res)[SESSION_COOKIE] ?? '',
      SESSION_SECRET,
    );
    expect(session).toMatchObject({ drive: true, exp: soon });
  });

  it('puts the folder it made in the new session, for the header’s Open Drive link', async () => {
    await signIn(world);
    googleConnects();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    const session = await verifySessionToken(
      cookiesOf(res)[SESSION_COOKIE] ?? '',
      SESSION_SECRET,
    );
    expect(session?.folder).toBe('new-folder');
  });

  it('reuses the folder it already knows', async () => {
    await signIn(world);
    world.raw
      .prepare("UPDATE users SET recipes_folder_id = 'old-folder'")
      .run();
    const requested = googleConnects();
    await connect({ [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }) });
    expect(requested.filter((r) => r.includes('/drive/v3/files'))).toEqual([]);
    expect(
      world.raw.prepare('SELECT recipes_folder_id AS f FROM users').get(),
    ).toEqual({ f: 'old-folder' });
  });

  it('refuses a different Google account than the one signed in, and stores nothing', async () => {
    await signIn(world);
    googleConnects({ sub: 'someone-else' });
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app?drive=error');
    expect(
      world.raw.prepare('SELECT refresh_token_enc AS t FROM users').get(),
    ).toEqual({ t: null });
  });

  it('answers denied when the Drive permission was unticked', async () => {
    await signIn(world);
    googleConnects({ scope: 'openid' });
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    expect(locationOf(res)?.href).toBe(
      'https://chowdown.test/app?drive=denied',
    );
    expect(
      world.raw.prepare('SELECT refresh_token_enc AS t FROM users').get(),
    ).toEqual({ t: null });
  });

  it('answers an error when Google sent no refresh token', async () => {
    await signIn(world);
    googleConnects({ refresh: false });
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app?drive=error');
  });

  it('sends someone who is not signed in to sign in instead', async () => {
    googleConnects();
    const res = await connect();
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
    expect(world.raw.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: 0,
    });
  });

  it('will not attach Drive to the account of a session that was ended', async () => {
    await signIn(world, { epoch: 1 });
    googleConnects();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }, { ep: 0 }),
    });
    expect(locationOf(res)?.href).toBe('https://chowdown.test/?error=auth');
    expect(
      world.raw.prepare('SELECT refresh_token_enc AS t FROM users').get(),
    ).toEqual({ t: null });
  });

  it('answers an error when Google fails during the exchange', async () => {
    await signIn(world);
    answerFetch({ [TOKEN_URL]: () => json({ error: 'server_error' }, 500) });
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    expect(locationOf(res)?.href).toBe('https://chowdown.test/app?drive=error');
  });
});
