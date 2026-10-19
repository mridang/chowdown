import { describe, expect, it, jest } from '@jest/globals';

import {
  appOrigin,
  appOriginFromHeaders,
  isDatabaseBound,
  runInBackground,
} from '../../../src/lib/util/runtime';

describe('without a Cloudflare context (tests, scripts)', () => {
  it("uses the request's own origin as the app origin", () => {
    expect(appOrigin(new Request('http://localhost:3000/a/b?c=d'))).toBe(
      'http://localhost:3000',
    );
  });

  it('reports the database as not bound instead of throwing', () => {
    expect(isDatabaseBound()).toBe(false);
  });

  it('lets background work run on its own', async () => {
    let done = false;
    runInBackground(
      Promise.resolve().then(() => {
        done = true;
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('logs background work that fails rather than letting it escape', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    runInBackground(Promise.reject(new Error('boom')));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toHaveBeenCalledWith(
      'background task failed',
      expect.any(Error),
    );
    log.mockRestore();
  });
});

describe('appOriginFromHeaders', () => {
  it('uses the Host the browser used, and https unless told http', () => {
    expect(
      appOriginFromHeaders(new Headers({ host: 'chowdown.apps.mrida.ng' })),
    ).toBe('https://chowdown.apps.mrida.ng');
    expect(
      appOriginFromHeaders(
        new Headers({ host: 'chowdown.test', 'x-forwarded-proto': 'http' }),
      ),
    ).toBe('http://chowdown.test');
  });

  it('is http on localhost, where there is no TLS', () => {
    expect(appOriginFromHeaders(new Headers({ host: 'localhost:3737' }))).toBe(
      'http://localhost:3737',
    );
  });

  it('ignores a forwarded host that anyone could have sent', () => {
    expect(
      appOriginFromHeaders(
        new Headers({
          host: 'chowdown.apps.mrida.ng',
          'x-forwarded-host': 'evil.example',
        }),
      ),
    ).toBe('https://chowdown.apps.mrida.ng');
  });

  it('ignores a forwarded scheme that is not http or https', () => {
    expect(
      appOriginFromHeaders(
        new Headers({
          host: 'chowdown.apps.mrida.ng',
          'x-forwarded-proto': 'javascript',
        }),
      ),
    ).toBe('https://chowdown.apps.mrida.ng');
  });
});
