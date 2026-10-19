import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '../../../../src/components/landing/demo-recipes';
import { Features } from '../../../../src/components/landing/features/features';
import { html } from '../../render';

describe('Features', () => {
  const out = html(<Features recipes={RECIPES} />);

  it('is the section the "See what it does" button jumps to', () => {
    expect(out).toContain('id="features"');
  });

  it('renders every feature heading', () => {
    expect(out.match(/<h2/g)).toHaveLength(5);
    for (const title of [
      'Plain text, in your own Drive',
      'Paste a link, get a recipe',
      'Narrow it down in a click or two',
      'Big steps, your units',
      'Ask your assistant about your recipes',
    ]) {
      expect(out).toContain(title);
    }
  });

  it('draws a picture for each feature', () => {
    for (const label of [
      'A Google Drive folder of recipe files',
      'Pasting a link to import a recipe',
      'Filtering recipes by difficulty and time',
      'Cook mode on a phone',
      'A chat where an assistant suggests recipes',
    ]) {
      expect(out).toContain(label);
    }
  });
});
