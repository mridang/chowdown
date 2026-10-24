import { describe, expect, it } from '@jest/globals';

import { canonicalValue, facet, validateTags } from '@/domain/recipe/taxonomy';

describe('canonicalValue', () => {
  it('canonicalises case for a closed facet', () => {
    expect(canonicalValue('cuisine', 'indian')).toBe('Indian');
    expect(canonicalValue('difficulty', 'EASY')).toBe('Easy');
  });
  it('rejects values not in the vocabulary', () => {
    expect(canonicalValue('cuisine', 'Martian')).toBeUndefined();
  });
  it('lowercases open keywords', () => {
    expect(canonicalValue('keywords', 'Weeknight')).toBe('weeknight');
  });
  it('returns undefined for an unknown facet', () => {
    expect(canonicalValue('nonsense', 'x')).toBeUndefined();
  });
});

describe('facet', () => {
  it('finds a facet by key', () => {
    expect(facet('protein')?.label).toBe('Protein');
    expect(facet('protein')?.multi).toBe(true);
  });
});

describe('derived facets', () => {
  it('marks the eating style as worked out, not chosen', () => {
    expect(facet('diet_type')).toMatchObject({
      derived: true,
      values: ['Vegan', 'Vegetarian', 'Pescatarian', 'Non-vegetarian'],
    });
  });
  it('never takes the eating style from the tagger', () => {
    expect(validateTags({ diet_type: 'Vegan', cuisine: 'Indian' })).toEqual([
      ['cuisine', 'Indian'],
    ]);
  });
});

describe('validateTags', () => {
  it('keeps vocabulary values and drops the rest', () => {
    const pairs = validateTags({
      cuisine: 'Indian',
      protein: ['chicken', 'unicorn'],
      difficulty: 'Easy',
      bogus: 'value',
    });
    const map = Object.fromEntries(pairs);
    expect(map['cuisine']).toBe('Indian');
    expect(map['protein']).toBe('chicken');
    expect(map['difficulty']).toBe('Easy');
    expect(map['bogus']).toBeUndefined();
  });
  it('joins multi-valued facets into one line', () => {
    const pairs = validateTags({ protein: ['chicken', 'egg'] });
    expect(pairs).toEqual([['protein', 'chicken, egg']]);
  });
  it('takes only the first value for a single-valued facet', () => {
    const pairs = validateTags({ cuisine: ['Indian', 'Italian'] });
    expect(pairs).toEqual([['cuisine', 'Indian']]);
  });
  it('passes free-form keywords through (lowercased)', () => {
    const pairs = validateTags({ keywords: ['Spicy', 'weeknight'] });
    expect(pairs).toEqual([['keywords', 'spicy, weeknight']]);
  });
  it('omits facets with no accepted values', () => {
    expect(validateTags({ cuisine: 'Nowhere' })).toEqual([]);
  });
});
