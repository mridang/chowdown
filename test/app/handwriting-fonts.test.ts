import { describe, expect, it, jest } from '@jest/globals';

/** What each face was asked for, by the name of the loader that was called. */
const asked = new Map<string, Record<string, unknown>>();

// next/font only works inside the Next compiler, so each loader here just
// records its options and hands back the class `next/font` would have made.
const loader = (name: string) => (options: { readonly variable: string }) => {
  asked.set(name, options);
  return { variable: `var-class${options.variable}` };
};
jest.unstable_mockModule('next/font/google', () => ({
  Caveat: loader('Caveat'),
  Kalam: loader('Kalam'),
  Shadows_Into_Light: loader('Shadows_Into_Light'),
  Over_the_Rainbow: loader('Over_the_Rainbow'),
  Indie_Flower: loader('Indie_Flower'),
  Delicious_Handrawn: loader('Delicious_Handrawn'),
  La_Belle_Aurore: loader('La_Belle_Aurore'),
}));

const { HANDWRITING_VARIABLES } =
  await import('../../src/app/handwriting-fonts');

describe('the handwriting faces', () => {
  it('are seven', () => {
    expect(asked.size).toBe(7);
  });

  it('each cover Latin and Latin-extended, so names such as Łukasz are drawn in the face', () => {
    asked.forEach((options) =>
      expect(options['subsets']).toEqual(['latin', 'latin-ext']),
    );
  });

  it('swap in when they arrive, rather than never showing on a first visit', () => {
    asked.forEach((options) => expect(options['display']).toBe('swap'));
  });

  it('are not preloaded, so a page fetches only the face its name uses', () => {
    asked.forEach((options) => expect(options['preload']).toBe(false));
  });

  it('each fall back to the system cursive face', () => {
    asked.forEach((options) =>
      expect(options['fallback']).toEqual(['cursive']),
    );
  });

  it('are all defined on the page, in the order the component indexes them', () => {
    expect(HANDWRITING_VARIABLES.split(' ')).toEqual(
      [
        'caveat',
        'kalam',
        'shadows',
        'rainbow',
        'indie',
        'handrawn',
        'aurore',
      ].map((face) => `var-class--font-hand-${face}-face`),
    );
  });
});
