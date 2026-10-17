import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { trashRecipeFile } from '../../../src/lib/drive/drive-client';

const realFetch = globalThis.fetch;

/** Make the next `fetch` answer with the given status. */
function respond(status: number, body = '') {
  const fetchMock = jest.fn(async () => new Response(body, { status }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('trashRecipeFile', () => {
  it('marks the file trashed rather than deleting it', async () => {
    const fetchMock = respond(200, '{"id":"abc"}');
    expect(await trashRecipeFile('abc', 'tok')).toBe('trashed');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/files/abc');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ trashed: true });
  });

  it('reports a file that is already gone as missing', async () => {
    respond(404);
    expect(await trashRecipeFile('abc', 'tok')).toBe('missing');
  });

  it('throws on any other failure', async () => {
    respond(403, 'nope');
    await expect(trashRecipeFile('abc', 'tok')).rejects.toThrow('403');
  });
});
