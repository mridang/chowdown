import { describe, expect, it } from '@jest/globals';

import {
  hasFixedHeight,
  safeAreaVariables,
} from '../../src/views/host-context';

describe('safeAreaVariables', () => {
  it('turns the insets into pixel custom properties', () => {
    expect(
      safeAreaVariables({ top: 47, right: 0, bottom: 34, left: 12.5 }),
    ).toEqual([
      ['--safe-top', '47px'],
      ['--safe-right', '0px'],
      ['--safe-bottom', '34px'],
      ['--safe-left', '12.5px'],
    ]);
  });

  it('uses zero for missing, negative or non-numeric insets', () => {
    expect(safeAreaVariables(undefined).map(([, v]) => v)).toEqual([
      '0px',
      '0px',
      '0px',
      '0px',
    ]);
    expect(
      safeAreaVariables({
        top: -5,
        right: Number.NaN,
        bottom: Number.POSITIVE_INFINITY,
        left: 3,
      }).map(([, v]) => v),
    ).toEqual(['0px', '0px', '0px', '3px']);
  });
});

describe('hasFixedHeight', () => {
  it('is true when the host fixes the frame height', () => {
    expect(hasFixedHeight({ height: 600, maxWidth: 400 })).toBe(true);
  });

  it('is false when the height is flexible or unbounded', () => {
    expect(hasFixedHeight({ maxHeight: 600, width: 400 })).toBe(false);
    expect(hasFixedHeight({})).toBe(false);
    expect(hasFixedHeight(undefined)).toBe(false);
  });
});
