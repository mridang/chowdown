import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  CHANGED_ELSEWHERE,
  COULD_NOT_RENAME,
  patchTitle,
} from '@/app/(site)/recipe/[id]/_components/title-request';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('patchTitle', () => {
  it('patches the recipe’s title as a merge patch, guarded by its entity tag', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(patchTitle('dal', 'Red lentil dal', '"abc"')).resolves.toEqual(
      { saved: true },
    );
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('/api/recipes/dal');
    expect(init?.method).toBe('PATCH');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/merge-patch+json',
      'If-Match': '"abc"',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      title: 'Red lentil dal',
    });
  });

  it('says the recipe changed elsewhere when the entity tag is stale', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ detail: 'Precondition failed.' }, { status: 412 }),
      );
    await expect(patchTitle('dal', 'New', '"old"')).resolves.toEqual({
      saved: false,
      message: CHANGED_ELSEWHERE,
    });
  });

  it('shows the server’s own words when it refuses the title', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        {
          detail: 'The change is not valid.',
          errors: ['title: must be a non-empty string.'],
        },
        { status: 400 },
      ),
    );
    await expect(patchTitle('dal', ' ', '"abc"')).resolves.toEqual({
      saved: false,
      message: 'The change is not valid. title: must be a non-empty string.',
    });
  });

  it('shows the server’s own words when Drive cannot be reached', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ detail: 'Drive is not connected.' }, { status: 409 }),
      );
    await expect(patchTitle('dal', 'New', '"abc"')).resolves.toEqual({
      saved: false,
      message: 'Drive is not connected.',
    });
  });

  it('shows a plain sentence when the request fails outright', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(patchTitle('dal', 'New', '"abc"')).resolves.toEqual({
      saved: false,
      message: COULD_NOT_RENAME,
    });
  });
});
