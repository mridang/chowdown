import { describe, expect, it } from '@jest/globals';

import {
  EXPIRED_ROW_GRACE_SECONDS,
  PURGE_PROBABILITY,
  REVOKED_GRANT_KEEP_SECONDS,
  UNUSED_CIMD_CLIENT_KEEP_SECONDS,
  UNUSED_DCR_CLIENT_KEEP_SECONDS,
  purgeCutoffs,
  shouldPurge,
} from '../../../src/lib/oauth/retention';

const NOW = Date.parse('2026-06-01T00:00:00.000Z') / 1000;
const DAY = 86_400;

describe('purgeCutoffs', () => {
  it('keeps expired codes and tokens a day, so a replayed code is still recognised', () => {
    const cutoffs = purgeCutoffs(NOW);
    expect(cutoffs.codesExpiredBefore).toBe(NOW - DAY);
    expect(cutoffs.tokensExpiredBefore).toBe(NOW - DAY);
    expect(EXPIRED_ROW_GRACE_SECONDS).toBe(DAY);
  });

  it('writes the text cutoffs as ISO timestamps that sort like the stored ones', () => {
    const cutoffs = purgeCutoffs(NOW);
    expect(cutoffs.revokedTokensBefore).toBe('2026-05-31T00:00:00.000Z');
    expect(cutoffs.revokedGrantsBefore).toBe('2026-03-03T00:00:00.000Z');
    expect(cutoffs.unusedDcrClientsBefore).toBe('2026-05-25T00:00:00.000Z');
    expect(cutoffs.unusedCimdClientsBefore).toBe('2026-05-02T00:00:00.000Z');
  });

  it('keeps revoked grants longest, so a disconnected app can reconnect', () => {
    expect(REVOKED_GRANT_KEEP_SECONDS).toBeGreaterThan(
      UNUSED_CIMD_CLIENT_KEEP_SECONDS,
    );
    expect(UNUSED_CIMD_CLIENT_KEEP_SECONDS).toBeGreaterThan(
      UNUSED_DCR_CLIENT_KEEP_SECONDS,
    );
  });

  it('moves with the clock', () => {
    expect(purgeCutoffs(NOW + DAY).codesExpiredBefore).toBe(NOW);
  });
});

describe('shouldPurge', () => {
  it('fires for about one request in a hundred', () => {
    expect(PURGE_PROBABILITY).toBe(0.01);
    expect(shouldPurge(0)).toBe(true);
    expect(shouldPurge(0.0099)).toBe(true);
    expect(shouldPurge(0.01)).toBe(false);
    expect(shouldPurge(0.5)).toBe(false);
  });

  it('draws its own luck by default', () => {
    expect(typeof shouldPurge()).toBe('boolean');
  });
});
