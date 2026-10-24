import { describe, expect, it } from '@jest/globals';

import { pantryOf } from '@/domain/mcp/pantry-input';

describe('pantryOf', () => {
  it('reads strings, lists in one string, and objects', () => {
    expect(
      pantryOf(['3 tomatoes and 400 g pasta', { name: 'garlic', quantity: 2 }]),
    ).toEqual([
      { name: 'tomatoes', quantity: '3' },
      { name: 'pasta', quantity: '400 g' },
      { name: 'garlic', quantity: '2' },
    ]);
  });

  it('ignores junk', () => {
    expect(pantryOf([1, null, { name: '' }, '  ', [], {}])).toEqual([]);
  });

  it('reads a single string or object that is not in a list', () => {
    expect(pantryOf('garlic')).toEqual([{ name: 'garlic' }]);
    expect(pantryOf({ name: 'rice' })).toEqual([{ name: 'rice' }]);
    expect(pantryOf(undefined)).toEqual([]);
  });

  it('splits on commas, semicolons, ampersands and the word "and"', () => {
    expect(
      pantryOf('onions, garlic; ginger & chillies and lemons').map(
        (i) => i.name,
      ),
    ).toEqual(['onions', 'garlic', 'ginger', 'chillies', 'lemons']);
  });

  it('keeps words that merely contain "and" whole', () => {
    expect(pantryOf('sandwich bread, brandy').map((i) => i.name)).toEqual([
      'sandwich bread',
      'brandy',
    ]);
  });

  it('does not split inside brackets', () => {
    expect(pantryOf('tomatoes (ripe, red), basil')).toHaveLength(2);
  });

  it('keeps names that are one thing despite an "and"', () => {
    expect(pantryOf('salt and pepper').map((i) => i.name)).toEqual([
      'salt and pepper',
    ]);
  });

  it('gives a bare amount after a comma back to the item before it', () => {
    expect(pantryOf('tomatoes, 3')).toEqual([
      { name: 'tomatoes', quantity: '3' },
    ]);
  });

  it('keeps a quantity given as a separate field short', () => {
    const [item] = pantryOf([{ name: 'flour', quantity: 'x'.repeat(100) }]);
    expect(item?.quantity).toHaveLength(40);
  });

  it('reads at most 60 items', () => {
    expect(
      pantryOf(Array.from({ length: 80 }, (_, i) => `item${i}`)),
    ).toHaveLength(60);
  });

  it('keeps an item that comes with an amount after the name together', () => {
    expect(pantryOf(['Tomatoes, 3'])).toEqual([
      { name: 'Tomatoes', quantity: '3' },
    ]);
    expect(pantryOf('tomatoes (chopped, canned), 2 onions')).toEqual([
      { name: 'tomatoes (chopped, canned)' },
      { name: 'onions', quantity: '2' },
    ]);
  });

  it('does not split amounts or names that contain a comma or an "and"', () => {
    expect(pantryOf(['1,5 kg potatoes'])).toEqual([
      { name: 'potatoes', quantity: '1,5 kg' },
    ]);
    expect(pantryOf(['1,000 g flour'])).toEqual([
      { name: 'flour', quantity: '1,000 g' },
    ]);
    expect(pantryOf(['mac and cheese'])).toEqual([{ name: 'mac and cheese' }]);
    expect(pantryOf(['half and half, 2 eggs'])).toEqual([
      { name: 'half and half' },
      { name: 'eggs', quantity: '2' },
    ]);
  });

  it('ignores a bare number as an item', () => {
    expect(pantryOf(['3'])).toEqual([]);
  });

  it('caps how much it will read, so a huge request cannot hog the server', () => {
    const items = pantryOf(Array.from({ length: 5000 }, (_, i) => `item ${i}`));
    expect(items).toHaveLength(60);
    const long = pantryOf(['x'.repeat(100_000)]);
    expect(long[0]?.name.length).toBeLessThanOrEqual(80);
  });
});
