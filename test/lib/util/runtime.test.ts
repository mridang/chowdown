import { describe, expect, it, jest } from '@jest/globals';

import {
  appOrigin,
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
