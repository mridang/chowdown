import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';
import type { ReactElement } from 'react';

import { s256 } from '@/lib/oauth';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { quietSecurityLogs } from '../../../lib/oauth/quiet-logs';
import { htmlAt } from '../../../components/render';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class RedirectedError extends Error {
  override name = 'RedirectedError';

  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

/**
 * The signed-in user (null for nobody), the request headers the page sees, and
 * what this app's own gate before the approval shows (null lets the person
 * through), with the return addresses it was handed.
 */
const state: {
  user: { email: string } | null;
  requestHeaders: Record<string, string>;
  gate: ReactElement | null;
  gatedReturns: string[];
} = { user: null, requestHeaders: {}, gate: null, gatedReturns: [] };

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectedError(to);
  },
}));
jest.unstable_mockModule('next/headers', () => ({
  headers: async () =>
    new Headers({ host: 'app.test', ...state.requestHeaders }),
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));
jest.unstable_mockModule('@/app/oauth/authorize/app-gate', () => ({
  approvalGate: (...args: readonly [unknown, string]) => {
    state.gatedReturns.push(args[1]);
    return state.gate;
  },
}));

const { default: AuthorizePage } = await import('@/app/oauth/authorize/page');

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CIMD = 'https://claude.ai/oauth/meta.json';

quietSecurityLogs();

let raw: DatabaseSync;
let restore: () => void;
let challenge: string;

beforeEach(async () => {
  state.user = { email: 'someone@example.com' };
  state.requestHeaders = {};
  state.gate = null;
  state.gatedReturns = [];
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  challenge = await s256(VERIFIER);
  const client = raw.prepare(
    'INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  client.run(
    'dcr_abc',
    'dcr',
    'Assistant',
    JSON.stringify(['https://app.example/cb']),
    '2026-01-01T00:00:00.000Z',
    null,
    null,
  );
  // A metadata-document client with a copy that is fresh, so no fetch happens.
  client.run(
    CIMD,
    'cimd',
    'Claude',
    JSON.stringify(['https://claude.ai/cb']),
    '2026-01-01T00:00:00.000Z',
    new Date().toISOString(),
    new Date(Date.now() + 3_600_000).toISOString(),
  );
});

afterEach(() => restore());

/** Render the page for these query parameters; a redirect comes back as its target. */
async function visit(
  query: Record<string, string | undefined> = {},
): Promise<{ redirectedTo: string } | { markup: string }> {
  const params = {
    client_id: 'dcr_abc',
    redirect_uri: 'https://app.example/cb',
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    ...query,
  };
  const searchParams = Promise.resolve(
    Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
  );
  try {
    const element: ReactElement = await AuthorizePage({ searchParams });
    return { markup: htmlAt(element) };
  } catch (error) {
    if (error instanceof RedirectedError) {
      return { redirectedTo: error.to };
    }
    throw error;
  }
}

describe('the authorize page', () => {
  it('shows the approval screen to a signed-in person the app lets through', async () => {
    const result = await visit();
    expect(result).toHaveProperty('markup');
    const { markup } = result as { markup: string };
    expect(markup).toContain('Connect <span');
    expect(markup).toContain('Assistant');
    expect(markup).toContain('someone@example.com');
    expect(markup).toContain('action="/oauth/consent"');
    expect(markup).toContain('name="access"');
  });

  it('sends a signed-out person to sign in, and back to the same request afterwards', async () => {
    state.user = null;
    const result = await visit();
    expect(result).toHaveProperty('redirectedTo');
    const to = (result as { redirectedTo: string }).redirectedTo;
    expect(to).toMatch(/^\/auth\/login\?returnTo=/);
    const back = new URL(
      decodeURIComponent(to.split('returnTo=', 2)[1] ?? ''),
      'https://app.test',
    );
    expect(back.pathname).toBe('/oauth/authorize');
    expect(back.searchParams.get('client_id')).toBe('dcr_abc');
    expect(back.searchParams.get('state')).toBe('xyz');
  });

  it('shows what the app asks for first instead of the approval', async () => {
    state.gate = <p>Do this first</p>;
    const { markup } = (await visit()) as { markup: string };
    expect(markup).toContain('Do this first');
    expect(markup).not.toContain('action="/oauth/consent"');
  });

  it('hands the app the way back to the same request', async () => {
    await visit();
    const [back = ''] = state.gatedReturns;
    const url = new URL(back, 'https://app.test');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('dcr_abc');
    expect(url.searchParams.get('state')).toBe('xyz');
  });

  describe('a problem with the request', () => {
    it('shows an unknown client as an error, with no way back to anywhere', async () => {
      const { markup } = (await visit({ client_id: 'nobody' })) as {
        markup: string;
      };
      expect(markup).toContain('Can&#x27;t connect this app');
      expect(markup).toContain('invalid_client');
      expect(markup).not.toContain('Return to the app');
    });

    it('shows a redirect address the client never registered as an error, never redirecting to it', async () => {
      const result = await visit({ redirect_uri: 'https://evil.example/cb' });
      expect(result).toHaveProperty('markup');
      expect((result as { markup: string }).markup).not.toContain(
        'evil.example',
      );
    });

    it('does not redirect an anonymously registered client before the person has seen anything, and offers the way back as a link', async () => {
      const result = await visit({ response_type: 'token' });
      expect(result).not.toHaveProperty('redirectedTo');
      const { markup } = result as { markup: string };
      expect(markup).toContain('unsupported_response_type');
      expect(markup).toContain('Return to the app');
      expect(markup).toContain('https://app.example/cb');
      const href = /href="([^"]*)"[^>]*>Return to the app/.exec(markup)?.[1];
      const link = new URL((href ?? '').replaceAll('&amp;', '&'));
      expect(link.origin + link.pathname).toBe('https://app.example/cb');
      expect(link.searchParams.get('error')).toBe('unsupported_response_type');
      expect(link.searchParams.get('state')).toBe('xyz');
      expect(link.searchParams.get('iss')).toBe('https://app.test');
    });

    it('does not redirect for a signed-out person either: the error comes before sign-in', async () => {
      state.user = null;
      const result = await visit({ response_type: 'token' });
      expect(result).toHaveProperty('markup');
    });

    it('still redirects the error of a client whose addresses its own domain published', async () => {
      const result = await visit({
        client_id: CIMD,
        redirect_uri: 'https://claude.ai/cb',
        response_type: 'token',
      });
      expect(result).toHaveProperty('redirectedTo');
      const to = new URL((result as { redirectedTo: string }).redirectedTo);
      expect(to.origin + to.pathname).toBe('https://claude.ai/cb');
      expect(to.searchParams.get('error')).toBe('unsupported_response_type');
      expect(to.searchParams.get('state')).toBe('xyz');
      expect(to.searchParams.get('iss')).toBe('https://app.test');
    });

    it('says the client is busy, not unknown, when too many documents are being fetched', async () => {
      raw.prepare('DELETE FROM oauth_clients WHERE client_id = ?').run(CIMD);
      raw
        .prepare(
          'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)',
        )
        .run('oauth-cimd-all:all', Math.floor(Date.now() / 1000), 10_000);
      const { markup } = (await visit({
        client_id: CIMD,
        redirect_uri: 'https://claude.ai/cb',
      })) as { markup: string };
      expect(markup).toContain('temporarily_unavailable');
    });
  });

  it('does not fetch a client document from this very site', async () => {
    const fetched = jest.spyOn(globalThis, 'fetch');
    const { markup } = (await visit({
      client_id: 'https://app.test/.well-known/oauth-authorization-server',
      redirect_uri: 'https://app.test/cb',
    })) as { markup: string };
    expect(markup).toContain('invalid_client');
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });

  it('reads the first value when a parameter is repeated', async () => {
    const element = await AuthorizePage({
      searchParams: Promise.resolve({
        client_id: ['dcr_abc', 'other'],
        redirect_uri: 'https://app.example/cb',
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }),
    });
    expect(htmlAt(element)).toContain('Assistant');
  });

  it('shows the host of the redirect address and notes one on a different site than the publisher', async () => {
    raw
      .prepare('UPDATE oauth_clients SET redirect_uris = ? WHERE client_id = ?')
      .run(JSON.stringify(['https://elsewhere.example/cb']), CIMD);
    const { markup } = (await visit({
      client_id: CIMD,
      redirect_uri: 'https://elsewhere.example/cb',
    })) as { markup: string };
    expect(markup).toContain('elsewhere.example');
    expect(markup).toContain('is not on claude.ai');
  });
});
