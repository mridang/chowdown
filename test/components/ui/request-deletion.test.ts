import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { requestDeletion } from '@/components/ui/request-deletion';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('requestDeletion', () => {
  it('sends DELETE to the address and reports success', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(requestDeletion('/api/things/1', 'offline')).resolves.toEqual({
      deleted: true,
    });
    expect(fetcher).toHaveBeenCalledWith('/api/things/1', { method: 'DELETE' });
  });

  it('carries the server’s own words when it refuses', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ detail: 'Not yours to delete.' }, { status: 404 }),
      );
    await expect(requestDeletion('/api/things/1', 'offline')).resolves.toEqual({
      deleted: false,
      message: 'Not yours to delete.',
    });
  });

  it('says the fallback sentence when the server cannot be reached', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      requestDeletion('/api/things/1', 'Nothing was deleted.'),
    ).resolves.toEqual({ deleted: false, message: 'Nothing was deleted.' });
  });
});
