import { describe, expect, it } from '@jest/globals';

import { RecipeRow, RecipeRows } from '@/components/recipes/recipe-row';
import { toCardRecipe } from '@/domain/recipe/card-data';
import { html } from '../render';

const SOURCE = [
  '>> title: Dal',
  '>> source: https://www.example.com/dal',
  '>> time: 35 min',
  '>> difficulty: Easy',
  '>> cuisine: Indian',
  '>> protein: chicken',
  '',
  'Cook @chicken{200%g}.',
  '',
].join('\n');

const card = (source: string, name = 'Dal.cook', favourite = false) =>
  toCardRecipe({ drive_file_id: 'dal', name, source }, favourite);

describe('RecipeRow', () => {
  const recipe = card(SOURCE);

  it('is one link to the recipe page', () => {
    const out = html(<RecipeRow recipe={recipe} />);
    expect(out).toContain('href="/recipe/dal"');
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it('shows the title, cuisine, source site and facts', () => {
    const out = html(<RecipeRow recipe={recipe} headingLevel="h2" />);
    expect(out).toMatch(/<h2[^>]*>Dal<\/h2>/);
    expect(out).toContain('>Indian<');
    expect(out).toContain('example.com');
    expect(out).toContain('35 min');
    expect(out).toContain('Easy');
    expect(out).toContain('Chicken');
  });

  it('leaves out what the recipe lacks', () => {
    const out = html(<RecipeRow recipe={card('>> title: X\n', 'X.cook')} />);
    expect(out).not.toContain('text-[13px]');
    expect(out).not.toContain('tracking-[0.14em]');
    expect(out).not.toContain('mt-0.5 truncate');
  });

  it('marks a bare idea in front of its title', () => {
    const idea = card('Stir @egg{2}.\n', 'Eggs [uncurated].cook');
    expect(html(<RecipeRow recipe={idea} />)).toContain('>Idea</span>');
    expect(html(<RecipeRow recipe={recipe} />)).not.toContain('>Idea<');
  });

  it('draws a demo row’s heart as decoration, not a control', () => {
    const out = html(<RecipeRow recipe={recipe} />);
    expect(out).not.toContain('<button');
    expect(out).toContain('aria-hidden="true"');
  });

  it.each([
    [false, 'Add to favourites'],
    [true, 'Remove from favourites'],
  ])('gives a live row a heart button (favourite: %s)', (on, label) => {
    const out = html(<RecipeRow recipe={card(SOURCE, 'Dal.cook', on)} live />);
    expect(out).toContain('<button');
    expect(out).toContain(`aria-label="${label}"`);
  });

  it('is painted at once when it is above the fold and deferred otherwise', () => {
    expect(html(<RecipeRow recipe={recipe} priority />)).not.toContain(
      'content-visibility',
    );
    expect(html(<RecipeRow recipe={recipe} />)).toContain('content-visibility');
  });
});

describe('RecipeRows', () => {
  it('stacks its rows', () => {
    expect(html(<RecipeRows>x</RecipeRows>)).toContain('flex flex-col');
  });
});
