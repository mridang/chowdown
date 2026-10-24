import { describe, expect, it } from '@jest/globals';

import {
  fileSlug,
  previewLines,
  tidyLine,
} from '@/components/landing/cook-file';

describe('fileSlug', () => {
  it('joins the words of a title with hyphens', () => {
    expect(fileSlug('Smoky Chipotle Chicken Tacos')).toBe(
      'smoky-chipotle-chicken-tacos',
    );
  });

  it('trims punctuation and spaces at the edges', () => {
    expect(fileSlug('  15-Minute Curry!  ')).toBe('15-minute-curry');
  });

  it('cuts to the limit without leaving a trailing hyphen', () => {
    const slug = fileSlug('Slow Roasted Lamb Shoulder with Herbs', 17);
    expect(slug).toBe('slow-roasted-lamb');
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('tidyLine', () => {
  it('shows a metadata unit the way a person writes it', () => {
    expect(tidyLine('>> time: 35%minutes')).toBe('>> time: 35 minutes');
  });

  it('leaves a step alone, including its quantity separators', () => {
    expect(tidyLine('Add @flour{200%g}.')).toBe('Add @flour{200%g}.');
  });

  it('cuts a long line with an ellipsis', () => {
    const tidy = tidyLine('x'.repeat(120));
    expect(tidy).toHaveLength(91);
    expect(tidy.endsWith('…')).toBe(true);
  });
});

describe('previewLines', () => {
  const source = [
    '>> title: Tacos',
    '>> images: https://example.com/a.jpg',
    '>> keywords: quick',
    '>> favourite: true',
    '',
    'Warm @tortillas{8}.',
    'Serve.',
  ].join('\n');

  it('skips blank lines and machine-only metadata', () => {
    expect(previewLines(source, 10)).toEqual([
      '>> title: Tacos',
      'Warm @tortillas{8}.',
      'Serve.',
    ]);
  });

  it('stops at the limit', () => {
    expect(previewLines(source, 2)).toHaveLength(2);
  });

  it('returns nothing for an empty source', () => {
    expect(previewLines('', 5)).toEqual([]);
  });
});
