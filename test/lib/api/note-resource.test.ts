import { describe, expect, it } from '@jest/globals';

import {
  noteIndex,
  noteResource,
  parseNoteInput,
} from '../../../src/lib/api/note-resource';

describe('noteResource', () => {
  it('numbers notes from 1 and uses upper-case scopes', () => {
    expect(
      noteResource({ scope: 'general', key: '', text: 'Great' }, 0),
    ).toEqual({
      id: '1',
      scope: 'GENERAL',
      text: 'Great',
    });
  });

  it('exposes the ingredient or the step number', () => {
    expect(
      noteResource({ scope: 'ingredient', key: 'lime', text: 'x' }, 1),
    ).toMatchObject({
      id: '2',
      scope: 'INGREDIENT',
      ingredient: 'lime',
    });
    expect(
      noteResource({ scope: 'step', key: '3', text: 'x' }, 2),
    ).toMatchObject({
      scope: 'STEP',
      step: 3,
    });
  });
});

describe('noteIndex', () => {
  it('turns a position id into a 0-based index', () => {
    expect(noteIndex('1')).toBe(0);
    expect(noteIndex('12')).toBe(11);
  });

  it('refuses anything that is not a positive whole number', () => {
    for (const bad of ['0', '-1', 'a', '1.5', '', '01', '1234567']) {
      expect(noteIndex(bad)).toBeUndefined();
    }
  });
});

describe('parseNoteInput', () => {
  it('reads a general, ingredient or step note', () => {
    expect(parseNoteInput({ text: ' hi ' })).toEqual({
      ok: true,
      note: { scope: 'general', key: '', text: 'hi' },
    });
    expect(parseNoteInput({ text: 'x', ingredient: ' lime ' })).toEqual({
      ok: true,
      note: { scope: 'ingredient', key: 'lime', text: 'x' },
    });
    expect(parseNoteInput({ text: 'x', step: 2 })).toEqual({
      ok: true,
      note: { scope: 'step', key: '2', text: 'x' },
    });
  });

  it('reports each problem', () => {
    const result = parseNoteInput({ text: '', ingredient: 'a', step: 0 });
    expect(result.ok).toBe(false);
    expect((result as { errors: string[] }).errors.join(' ')).toMatch(
      /text.*step.*both/s,
    );
  });

  it('refuses a very long note and a fractional step', () => {
    expect(parseNoteInput({ text: 'x'.repeat(2001) }).ok).toBe(false);
    expect(parseNoteInput({ text: 'x', step: 1.5 }).ok).toBe(false);
  });
});
