import { describe, expect, it } from '@jest/globals';

import { appendNote, extractNotes } from '../../../src/lib/recipe/cook-text';

describe('appendNote + extractNotes', () => {
  it('appends and reads back a general note', () => {
    const out = appendNote('>> title: X\n\nCook it.\n', {
      scope: 'general',
      key: '',
      text: 'tastes better next day',
    });
    expect(out).toContain('-- [note] tastes better next day');
    expect(extractNotes(out)).toEqual([
      { scope: 'general', key: '', text: 'tastes better next day' },
    ]);
  });

  it('attaches a note to an ingredient', () => {
    const out = appendNote('>> title: X\n', {
      scope: 'ingredient',
      key: 'avocado',
      text: 'use 3 instead of 2',
    });
    expect(out).toContain('-- [note ingredient:avocado] use 3 instead of 2');
    expect(extractNotes(out)[0]).toEqual({
      scope: 'ingredient',
      key: 'avocado',
      text: 'use 3 instead of 2',
    });
  });

  it('attaches a note to a step', () => {
    const out = appendNote('>> title: X\n', {
      scope: 'step',
      key: '2',
      text: 'marinate overnight',
    });
    expect(extractNotes(out)[0]).toEqual({
      scope: 'step',
      key: '2',
      text: 'marinate overnight',
    });
  });

  it('flattens multi-line note text to one comment line', () => {
    const out = appendNote('>> title: X\n', {
      scope: 'general',
      key: '',
      text: 'line one\nline two',
    });
    expect(out).toContain('-- [note] line one line two');
    expect(out.match(/\[note\]/g)).toHaveLength(1);
  });

  it('does not disturb the original method or the cooking log', () => {
    const src = '>> title: X\n\nMash it.\n-- [cook 2026-01-01] great\n';
    const out = appendNote(src, { scope: 'general', key: '', text: 'spicy' });
    expect(out).toContain('Mash it.');
    expect(out).toContain('-- [cook 2026-01-01] great');
    // The cooking-log line is not misread as a note.
    expect(extractNotes(out)).toEqual([
      { scope: 'general', key: '', text: 'spicy' },
    ]);
  });
});
