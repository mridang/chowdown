import { describe, expect, it } from '@jest/globals';

import { EXTRA_PURPOSES } from '../../../src/lib/auth/app';
import { completeDriveConnect } from '../../../src/lib/auth/drive-callback';
import { OTHER_FLOWS, afterSignIn } from '../../../src/lib/auth/hooks';
import type { User } from '../../../src/lib/auth/store';

describe('afterSignIn', () => {
  it('has nothing more to do once the person is recorded', async () => {
    await expect(afterSignIn({ id: 1 } as User)).resolves.toBeUndefined();
  });
});

describe('OTHER_FLOWS', () => {
  it('has a flow for every extra ask the app can start', () => {
    expect(Object.keys(OTHER_FLOWS).toSorted()).toEqual(
      [...EXTRA_PURPOSES].toSorted(),
    );
  });

  it('finishes a Drive round trip by connecting Drive', () => {
    expect(OTHER_FLOWS['drive']?.complete).toBe(completeDriveConnect);
  });

  it('sends a failed or cancelled Drive connection back to the list with a fixed reason', () => {
    expect(OTHER_FLOWS['drive']?.failurePath('error')).toBe('/app?drive=error');
    expect(OTHER_FLOWS['drive']?.failurePath('denied')).toBe(
      '/app?drive=denied',
    );
  });
});
