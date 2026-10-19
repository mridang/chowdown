import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { postNote } from '../../../../../../src/app/(site)/recipe/[id]/_components/note-request';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('postNote', () => {
  it('posts the trimmed note as JSON to the recipe’s notes', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    await expect(postNote('dal', '  more salt ', 'salt')).resolves.toEqual({
      saved: true,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('/api/recipes/dal/notes');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({
      text: 'more salt',
      ingredient: 'salt',
    });
  });

  it('leaves the ingredient out for a note on the whole recipe', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    await postNote('dal', 'lovely', '');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      text: 'lovely',
    });
  });

  it('shows the server’s own words when it refuses', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ detail: 'That note is too long.' }, { status: 400 }),
      );
    await expect(postNote('dal', 'x', '')).resolves.toEqual({
      saved: false,
      message: 'That note is too long.',
    });
  });

  it('shows a plain sentence when the request fails outright', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(postNote('dal', 'x', '')).resolves.toEqual({
      saved: false,
      message: 'Could not save the note.',
    });
  });
});
