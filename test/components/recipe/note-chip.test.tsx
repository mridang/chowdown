import { describe, expect, it } from '@jest/globals';

import { NoteChip } from '../../../src/components/recipe/note-chip';
import { html } from '../render';

describe('NoteChip', () => {
  it('says whose note it is, then the note', () => {
    const out = html(<NoteChip text="use less salt" />);
    expect(out.replace(/<[^>]*>/g, '')).toBe('Your note: use less salt');
  });

  it('draws the note icon so it is not told apart by colour alone', () => {
    expect(html(<NoteChip text="x" />)).toContain('<svg');
  });

  it('takes extra classes from the caller', () => {
    expect(html(<NoteChip text="x" className="ml-4" />)).toContain('ml-4');
  });
});
