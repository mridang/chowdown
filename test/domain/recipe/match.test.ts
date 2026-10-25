import { describe, expect, it } from '@jest/globals';

import type { DriveFile } from '@/lib/google';
import { matchFile, resolveFile } from '@/domain/recipe/match';

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

describe('matchFile ignoring accents', () => {
  const accented = [
    { id: 'a', name: 'Crème brûlée.cook' },
    { id: 'b', name: 'Jalapeño poppers.cook' },
  ] as DriveFile[];

  it('finds a name written without its accents, by exact name and by part of a name', () => {
    expect(matchFile(accented, 'creme brulee')?.id).toBe('a');
    expect(matchFile(accented, 'BRULEE')?.id).toBe('a');
    expect(matchFile(accented, 'jalapeno')?.id).toBe('b');
  });

  it('finds a name written with accents the recipe lacks', () => {
    const plain = [{ id: 'p', name: 'Creme brulee.cook' }] as DriveFile[];
    expect(matchFile(plain, 'Crème brûlée')?.id).toBe('p');
  });

  it('still matches an id exactly, and only exactly', () => {
    const ids = [{ id: 'AbC', name: 'One.cook' }] as DriveFile[];
    expect(matchFile(ids, 'AbC')?.id).toBe('AbC');
    expect(resolveFile(ids, 'abc')).toEqual({ kind: 'none' });
  });
});

describe('matchFile with a blank reference', () => {
  const files = [
    { id: 'a', name: 'Aloo gobi.cook' },
    { id: 'b', name: 'Biryani.cook' },
  ];

  it('points at nothing, so a missing recipe argument never picks the first recipe', () => {
    expect(matchFile(files, '')).toBeUndefined();
    expect(matchFile(files, '   ')).toBeUndefined();
  });
});

describe('resolveFile', () => {
  const pies = [
    { id: 'a', name: 'Apple pie.cook' },
    { id: 'b', name: 'Pie crust.cook' },
    { id: 'c', name: 'Key lime pie.cook' },
    { id: 'd', name: 'Soup.cook' },
    { id: 'e', name: 'Soup.cook' },
  ] as DriveFile[];

  it('is certain about an id, even when the same text is also a name', () => {
    expect(resolveFile(pies, 'a')).toEqual({ kind: 'one', file: pies[0] });
  });

  it('is certain about an exact name that only one recipe has, even if others contain it', () => {
    expect(resolveFile(pies, 'Pie crust')).toEqual({
      kind: 'one',
      file: pies[1],
    });
  });

  it('is certain about a part of a name that only one recipe contains', () => {
    expect(resolveFile(pies, 'lime')).toEqual({ kind: 'one', file: pies[2] });
  });

  it('is unsure when several names contain the text, listing the best first', () => {
    expect(resolveFile(pies, 'pie')).toEqual({
      kind: 'many',
      files: [pies[0], pies[1], pies[2]],
    });
  });

  it('is unsure when several recipes have exactly that name', () => {
    expect(resolveFile(pies, 'soup')).toEqual({
      kind: 'many',
      files: [pies[3], pies[4]],
    });
  });

  it('finds nothing for a blank reference or a name nobody has', () => {
    expect(resolveFile(pies, '')).toEqual({ kind: 'none' });
    expect(resolveFile(pies, '  ')).toEqual({ kind: 'none' });
    expect(resolveFile(pies, 'pizza')).toEqual({ kind: 'none' });
  });
});
