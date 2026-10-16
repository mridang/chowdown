import { describe, expect, it } from '@jest/globals';

import type { DriveFile } from '../../../src/lib/drive/drive-client';
import { matchFile } from '../../../src/lib/recipe/match';

const files = [
  { id: 'a1', name: 'Chicken Ghee Roast.cook' },
  { id: 'b2', name: 'Chicken Ghee Roast.cook' },
  { id: 'c3', name: 'Mutton Rezala.cook' },
  { id: 'd4', name: 'paneer ki sabji [uncurated].cook' },
] as DriveFile[];

describe('matchFile', () => {
  it('prefers an exact file id, so duplicate titles can be told apart', () => {
    expect(matchFile(files, 'b2')?.id).toBe('b2');
    expect(matchFile(files, 'a1')?.id).toBe('a1');
  });

  it('matches an exact display name ignoring case', () => {
    expect(matchFile(files, 'mutton rezala')?.id).toBe('c3');
  });

  it('falls back to a partial display name', () => {
    expect(matchFile(files, 'rezala')?.id).toBe('c3');
  });

  it('ignores the uncurated marker when matching names', () => {
    expect(matchFile(files, 'paneer ki sabji')?.id).toBe('d4');
  });

  it('returns the first of several identical titles when given a name', () => {
    expect(matchFile(files, 'Chicken Ghee Roast')?.id).toBe('a1');
  });

  it('is undefined when nothing matches', () => {
    expect(matchFile(files, 'lasagne')).toBeUndefined();
  });
});
