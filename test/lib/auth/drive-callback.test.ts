import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { NextResponse } from 'next/server';

import { SESSION_COOKIE, SIGN_IN_FAILED_PATH } from '@/domain/auth/app';
import { completeDriveConnect } from '@/domain/auth/drive-callback';
import { DRIVE_SCOPE } from '@/domain/auth/drive-oauth';
import { verifySessionToken } from '@/lib/session';
import { decryptSecret } from '@/lib/crypto';
import {
  ORIGIN,
  answerFetch,
  nextRequest,
  openWorld,
  signIn,
  type World,
} from '../../app/api/world';
import { SESSION_SECRET, sessionTokenFor } from './session-fixture';

let world: World;

beforeEach(() => {
  world = openWorld();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => world.close());

const DRIVE_URL = 'https://www.googleapis.com/drive/v3/files';

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

/** Everything the flow set on the response, by cookie name. */
const cookiesOf = (res: NextResponse) =>
  Object.fromEntries(res.cookies.getAll().map((c) => [c.name, c.value]));

const where = (res: Response) => res.headers.get('location');

/** The Drive API, making a folder called `new-folder` when asked to. */
const driveAnswers = () =>
  answerFetch({
    [DRIVE_URL]: (init) =>
      init?.method === 'POST'
        ? json({ id: 'new-folder' })
        : json({ files: [] }),
  });

/**
 * Finish a Drive round trip for `sub`, with or without the Drive permission and
 * a refresh token, from a browser holding `cookies`.
 */
function connect(
  cookies: Record<string, string> = {},
  options: {
    sub?: string;
    scope?: string;
    refresh?: boolean;
    returnTo?: string;
  } = {},
) {
  return completeDriveConnect(
    {
      request: nextRequest('/auth/callback', cookies),
      env: world.env as unknown as CloudflareEnv,
      origin: ORIGIN,
      returnTo: options.returnTo,
    },
    { sub: options.sub ?? 'sub-1' },
    {
      access_token: 'at',
      expires_in: 3599,
      scope: options.scope ?? `openid ${DRIVE_SCOPE}`,
      ...(options.refresh === false
        ? {}
        : { refresh_token: 'the-refresh-token' }),
    },
  );
}

describe('completeDriveConnect', () => {
  it('seals the refresh token, makes the folder, and reissues the session with Drive on', async () => {
    await signIn(world);
    const soon = Math.floor(Date.now() / 1000) + 3600;
    driveAnswers();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }, { exp: soon }),
    });
    expect(where(res)).toBe(`${ORIGIN}/app`);
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

  it('lands on the returnTo the trip began with', async () => {
    await signIn(world);
    driveAnswers();
    const res = await connect(
      { [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }) },
      { returnTo: '/recipe/abc' },
    );
    expect(where(res)).toBe(`${ORIGIN}/recipe/abc`);
  });

  it('puts the folder it made in the new session, for the header’s Open Drive link', async () => {
    await signIn(world);
    driveAnswers();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    const session = await verifySessionToken(
      cookiesOf(res)[SESSION_COOKIE] ?? '',
      SESSION_SECRET,
    );
    expect(session?.['folder']).toBe('new-folder');
  });

  it('reuses the folder it already knows', async () => {
    await signIn(world);
    world.raw
      .prepare("UPDATE users SET recipes_folder_id = 'old-folder'")
      .run();
    const requested = driveAnswers();
    await connect({ [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }) });
    expect(requested.filter((r) => r.includes('/drive/v3/files'))).toEqual([]);
    expect(
      world.raw.prepare('SELECT recipes_folder_id AS f FROM users').get(),
    ).toEqual({ f: 'old-folder' });
  });

  it('refuses a different Google account than the one signed in, and stores nothing', async () => {
    await signIn(world);
    driveAnswers();
    const res = await connect(
      { [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }) },
      { sub: 'someone-else' },
    );
    expect(where(res)).toBe(`${ORIGIN}/app?drive=error`);
    expect(
      world.raw.prepare('SELECT refresh_token_enc AS t FROM users').get(),
    ).toEqual({ t: null });
  });

  it('answers denied when the Drive permission was unticked', async () => {
    await signIn(world);
    driveAnswers();
    const res = await connect(
      { [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }) },
      { scope: 'openid' },
    );
    expect(where(res)).toBe(`${ORIGIN}/app?drive=denied`);
    expect(
      world.raw.prepare('SELECT refresh_token_enc AS t FROM users').get(),
    ).toEqual({ t: null });
  });

  it('answers an error when Google sent no refresh token', async () => {
    await signIn(world);
    driveAnswers();
    const res = await connect(
      { [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }) },
      { refresh: false },
    );
    expect(where(res)).toBe(`${ORIGIN}/app?drive=error`);
  });

  it('sends someone who is not signed in to sign in instead', async () => {
    driveAnswers();
    const res = await connect();
    expect(where(res)).toBe(`${ORIGIN}${SIGN_IN_FAILED_PATH}`);
    expect(world.raw.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: 0,
    });
  });

  it('will not attach Drive to the account of a session that was ended', async () => {
    await signIn(world, { epoch: 1 });
    driveAnswers();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }, { ep: 0 }),
    });
    expect(where(res)).toBe(`${ORIGIN}${SIGN_IN_FAILED_PATH}`);
    expect(
      world.raw.prepare('SELECT refresh_token_enc AS t FROM users').get(),
    ).toEqual({ t: null });
  });

  it('clears the one-time cookies once the trip is over', async () => {
    await signIn(world);
    driveAnswers();
    const res = await connect({
      [SESSION_COOKIE]: await sessionTokenFor({ id: 1 }),
    });
    expect(res.headers.get('set-cookie')).toContain('_oauth_state=;');
  });
});
