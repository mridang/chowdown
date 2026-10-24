import { describe, expect, it } from '@jest/globals';

import { AddNote } from '@/app/(site)/recipe/[id]/_components/add-note';
import { htmlAt } from '../../../../../components/render';

describe('AddNote', () => {
  const out = htmlAt(<AddNote recipeId="dal" ingredients={['onion']} />, {
    pathname: '/recipe/dal',
  });

  it('starts as a single "Add a note" button', () => {
    expect(out).toMatch(/<button[^>]*>.*Add a note<\/button>/s);
  });

  it('keeps the form closed until it is asked for', () => {
    expect(out).not.toContain('<textarea');
    expect(out).not.toContain('Save note');
    expect(out).not.toContain('Attach to');
  });
});
