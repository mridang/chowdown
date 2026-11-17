import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '@/components/landing/demo-recipes';
import { Features } from '@/components/landing/features/features';
import { html } from '../../render';

describe('Features', () => {
  const out = html(<Features recipes={RECIPES} />);

  it('is the section the "See what it does" button jumps to', () => {
    expect(out).toContain('id="features"');
  });

  it.each([
    'Plain text, in your own Drive',
    'Paste a link, get a recipe',
    'Narrow it down in a click or two',
    'Big steps, your units',
    'Ask your assistant about your recipes',
  ])('renders every feature heading (%j)', (title) => {
    expect(out.match(/<h2/gu)).toHaveLength(5);
    expect(out).toContain(title);
  });

  it.each([
    'A Google Drive folder of recipe files',
    'Pasting a link to import a recipe',
    'Filtering recipes by difficulty and time',
    'Cook mode on a phone',
    'A chat where an assistant suggests recipes',
  ])('draws a picture for each feature (%j)', (label) => {
    expect(out).toContain(label);
  });
});
