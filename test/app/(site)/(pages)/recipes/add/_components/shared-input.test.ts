import { describe, expect, it } from '@jest/globals';

import {
  ADD_RECIPES_PATH,
  MAX_PRESERVED_CHARACTERS,
  MAX_SHARED_CHARACTERS,
  addRecipesPath,
  sharedImportInput,
} from '@/app/(site)/(pages)/recipes/add/_components/shared-input';

describe('sharedImportInput', () => {
  it('is empty when nothing was shared', () => {
    expect(sharedImportInput({})).toBe('');
    expect(sharedImportInput({ title: '', text: '', url: '' })).toBe('');
  });

  it('uses the shared address, and not the page title that came with it', () => {
    expect(
      sharedImportInput({
        title: 'Best pancakes',
        url: 'https://example.com/pancakes',
      }),
    ).toBe('https://example.com/pancakes');
  });

  it('finds the address in the text when the sharing app left `url` empty', () => {
    expect(
      sharedImportInput({
        title: '',
        text: 'Look at this https://example.com/pancakes. So good!',
        url: '',
      }),
    ).toBe('https://example.com/pancakes');
  });

  it('prefers `url` over an address in `text`', () => {
    expect(
      sharedImportInput({
        text: 'also https://other.example/x',
        url: 'https://example.com/a',
      }),
    ).toBe('https://example.com/a');
  });

  it('takes the first address when the text has several', () => {
    expect(
      sharedImportInput({
        text: 'https://a.example/1 and https://b.example/2',
      }),
    ).toBe('https://a.example/1');
  });

  it('takes the first value of a parameter that was repeated', () => {
    expect(
      sharedImportInput({
        url: ['https://a.example/1', 'https://b.example/2'],
      }),
    ).toBe('https://a.example/1');
  });

  it('ignores addresses that are not http(s), or that carry a password', () => {
    expect(sharedImportInput({ url: 'javascript:alert(1)' })).toBe('');
    expect(sharedImportInput({ url: 'ftp://example.com/x' })).toBe('');
    expect(sharedImportInput({ url: 'https://user:pw@example.com/x' })).toBe(
      '',
    );
    expect(sharedImportInput({ url: 'android-app://com.example' })).toBe('');
  });

  it('falls back to the text when the only address is unusable', () => {
    expect(
      sharedImportInput({
        url: 'https://user:pw@example.com/x',
        text: 'Pancakes: flour, eggs, milk.',
      }),
    ).toBe('Pancakes: flour, eggs, milk.');
  });

  it('shares recipe text under its title, when there is no address', () => {
    expect(
      sharedImportInput({
        title: 'Pancakes',
        text: '200g flour\n2 eggs\n300ml milk',
      }),
    ).toBe('Pancakes\n\n200g flour\n2 eggs\n300ml milk');
  });

  it('does not repeat a title the text already starts with', () => {
    expect(
      sharedImportInput({ title: 'Pancakes', text: 'Pancakes\n2 eggs' }),
    ).toBe('Pancakes\n2 eggs');
  });

  it('does not take a title on its own for a recipe', () => {
    expect(sharedImportInput({ title: 'Best pancakes' })).toBe('');
  });

  it('reduces everything to plain text', () => {
    expect(sharedImportInput({ text: 'a\u0000b‮c​d\r\ne f' })).toBe(
      'abcd\ne\nf',
    );
  });

  it('keeps the text as text: markup is not touched, only ever shown as characters', () => {
    expect(
      sharedImportInput({ text: '<script>alert(1)</script> 2 eggs' }),
    ).toBe('<script>alert(1)</script> 2 eggs');
  });

  it('cuts long text at the cap, never in the middle of an emoji', () => {
    const out = sharedImportInput({
      text: '🍳'.repeat(MAX_SHARED_CHARACTERS + 5),
    });
    expect([...out]).toHaveLength(MAX_SHARED_CHARACTERS);
    expect(out).toBe('🍳'.repeat(MAX_SHARED_CHARACTERS));
  });

  it('refuses an address longer than the cap', () => {
    const long = `https://example.com/${'a'.repeat(MAX_SHARED_CHARACTERS)}`;
    expect(sharedImportInput({ url: long })).toBe('');
  });
});

describe('addRecipesPath', () => {
  it('is the plain page when nothing was shared', () => {
    expect(addRecipesPath('')).toBe(ADD_RECIPES_PATH);
  });

  it('carries an address as `url`', () => {
    expect(addRecipesPath('https://example.com/a?b=1&c=2')).toBe(
      '/recipes/add?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2',
    );
  });

  it('carries text as `text`', () => {
    expect(addRecipesPath('2 eggs\n1 cup milk')).toBe(
      '/recipes/add?text=2+eggs%0A1+cup+milk',
    );
  });

  it('drops what is too long for the sign-in cookie, rather than cutting it', () => {
    expect(addRecipesPath('x'.repeat(MAX_PRESERVED_CHARACTERS + 1))).toBe(
      ADD_RECIPES_PATH,
    );
  });

  it.each([
    'https://example.com/pancakes?utm=1&x=%20y',
    '2 eggs\n1 cup milk & some "quotes" # and ?',
  ])('comes back as the same input after signing in: %s', (input) => {
    const query = new URL(addRecipesPath(input), 'https://x.test').searchParams;
    expect(sharedImportInput(Object.fromEntries(query))).toBe(input);
  });
});
