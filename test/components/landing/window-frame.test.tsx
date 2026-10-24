import { describe, expect, it } from '@jest/globals';

import { WindowFrame } from '@/components/landing/window-frame';
import { html } from '../render';

describe('WindowFrame', () => {
  it('is one labelled image holding its children', () => {
    const out = html(<WindowFrame label="A picture">inside</WindowFrame>);
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="A picture"');
    expect(out).toContain('inside');
  });

  it('draws three window dots', () => {
    const out = html(<WindowFrame label="x">y</WindowFrame>);
    expect(out.match(/rounded-full/g)).toHaveLength(3);
  });

  it('shows a title only when given one', () => {
    expect(html(<WindowFrame label="x">y</WindowFrame>)).not.toContain(
      'font-mono',
    );
    expect(
      html(
        <WindowFrame label="x" title="Drive / Recipes">
          y
        </WindowFrame>,
      ),
    ).toContain('Drive / Recipes');
  });
});
