import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  createRecipeFile,
  isDriveFileId,
  listRecipeFiles,
  trashRecipeFile,
} from '@/lib/drive/drive-client';

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

describe('listRecipeFiles', () => {
  /** Answer each call with the next page, in order. */
  function pages(...bodies: object[]) {
    const fetchMock = jest.fn();
    for (const body of bodies) {
      fetchMock.mockImplementationOnce(
        async () => new Response(JSON.stringify(body), { status: 200 }),
      );
    }
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('follows the paging so a big folder is read in full', async () => {
    const fetchMock = pages(
      { files: [{ id: '1', name: 'A.cook' }], nextPageToken: 'next-1' },
      { files: [{ id: '2', name: 'B.cook' }] },
    );
    const files = await listRecipeFiles('folder', 'tok');
    expect(files.map((f) => f.id)).toEqual(['1', '2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = (fetchMock.mock.calls[1] as unknown as [string])[0];
    expect(new URL(second).searchParams.get('pageToken')).toBe('next-1');
  });

  it('keeps only .cook files', async () => {
    pages({
      files: [
        { id: '1', name: 'A.cook' },
        { id: '2', name: 'notes.txt' },
        { id: '3', name: 'B.COOK' },
      ],
    });
    expect((await listRecipeFiles('folder', 'tok')).map((f) => f.id)).toEqual([
      '1',
      '3',
    ]);
  });

  it('gives up after a sane number of pages rather than looping forever', async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({ files: [], nextPageToken: 'again' }), {
          status: 200,
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await listRecipeFiles('folder', 'tok');
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });
});

describe('createRecipeFile', () => {
  it('uploads with a boundary the recipe text cannot contain', async () => {
    const fetchMock = respond(200, '{"id":"x","name":"A.cook"}');
    await createRecipeFile(
      'folder',
      'A',
      'text with --chowdown-boundary in it',
      'tok',
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const type = (init.headers as Record<string, string>)['Content-Type']!;
    const boundary = /boundary=(.+)$/.exec(type)![1]!;
    expect(boundary).not.toBe('chowdown-boundary');
    const body = init.body as string;
    expect(body.split(`--${boundary}`)).toHaveLength(4);
  });
});

describe('isDriveFileId', () => {
  it('accepts the characters Drive ids are made of', () => {
    expect(isDriveFileId('1AbC_-xyz9')).toBe(true);
  });

  it('refuses anything that could change a query', () => {
    for (const id of ['', 'a b', "a'b", 'a/b', 'a.cook', '../x']) {
      expect(isDriveFileId(id)).toBe(false);
    }
  });
});
