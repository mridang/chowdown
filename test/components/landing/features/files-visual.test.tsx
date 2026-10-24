import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '@/components/landing/demo-recipes';
import { FilesVisual } from '@/components/landing/features/files-visual';
import { html } from '../../render';

describe('FilesVisual', () => {
  const out = html(<FilesVisual recipes={RECIPES} />);

  it('shows a Drive folder and a file open beside it', () => {
    expect(out).toContain('A Google Drive folder of recipe files');
    expect(out).toContain('A recipe as a plain text file');
  });

  it('lists up to six files, the first one highlighted', () => {
    expect(out.match(/<li/g)).toHaveLength(6);
    expect(out.match(/bg-marigold\/25/g)).toHaveLength(1);
  });
});
