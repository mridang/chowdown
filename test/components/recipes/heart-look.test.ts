import { describe, expect, it } from '@jest/globals';

import {
  HEART_BUTTON_BASE,
  heartLabelledClass,
  heartOverlayClass,
} from '../../../src/components/recipes/heart-look';

describe('heartOverlayClass', () => {
  it('is ember when the recipe is a favourite, and never hidden', () => {
    const on = heartOverlayClass(true);
    expect(on).toContain('text-ember');
    expect(on).not.toContain('opacity-0');
  });

  it('is muted otherwise, hidden on pointer devices until the card is hovered or focused', () => {
    const off = heartOverlayClass(false);
    expect(off).toContain('text-muted');
    expect(off).toContain('[@media(hover:hover)]:opacity-0');
    expect(off).toContain('group-hover:opacity-100');
    expect(off).toContain('group-focus-within:opacity-100');
  });

  it('leaves the position to the caller', () => {
    expect(heartOverlayClass(true)).not.toContain('absolute');
    expect(heartOverlayClass(false)).not.toContain('absolute');
  });
});

describe('heartLabelledClass', () => {
  it('outlines a favourite in the flame colour', () => {
    expect(heartLabelledClass(true)).toContain('border-flame');
    expect(heartLabelledClass(false)).toContain('border-field');
  });
});

describe('HEART_BUTTON_BASE', () => {
  it('dims while saving and shows the focus ring', () => {
    expect(HEART_BUTTON_BASE).toContain('disabled:opacity-60');
    expect(HEART_BUTTON_BASE).toContain('focus-ring');
  });
});
