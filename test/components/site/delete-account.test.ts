import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { deleteAccount } from '@/components/site/delete-account';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('deleteAccount', () => {
  it('sends DELETE /api/users/self and reports success', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteAccount()).resolves.toEqual({ deleted: true });
    expect(fetcher).toHaveBeenCalledWith('/api/users/self', {
      method: 'DELETE',
    });
  });

  it('carries the server’s own words when it refuses', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json(
          { title: 'Conflict', detail: 'Reconnect Google Drive first.' },
          { status: 409 },
        ),
      );
    await expect(deleteAccount()).resolves.toEqual({
      deleted: false,
      message: 'Reconnect Google Drive first.',
    });
  });

  it('says nothing was deleted when the request cannot be made', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(deleteAccount()).resolves.toEqual({
      deleted: false,
      message: expect.stringContaining('Nothing was deleted'),
    });
  });
});
