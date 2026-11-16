import { describe, expect, it } from '@jest/globals';

import { driveFailure } from '@/domain/api/drive-failure';
import { DriveNotConnectedError } from '@/domain/auth/drive-access';

describe('driveFailure', () => {
  it('says to connect Drive when that is what is missing', async () => {
    const res = driveFailure(new DriveNotConnectedError(), 'unused');
    expect(res.status).toBe(409);
    expect(await res.json<{ type: string }>()).toHaveProperty(
      'type',
      '/problems/drive-not-connected',
    );
  });

  it('reports any other failure as an upstream problem with the given detail', async () => {
    const res = driveFailure(new Error('Drive GET -> 500'), 'Nothing changed.');
    expect(res.status).toBe(502);
    expect(await res.json<{ detail: string }>()).toHaveProperty(
      'detail',
      'Nothing changed.',
    );
  });
});
