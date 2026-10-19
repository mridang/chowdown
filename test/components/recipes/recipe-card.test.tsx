import { describe, expect, it } from '@jest/globals';

import {
  PhotoBlock,
  RecipeCard,
  RecipeGrid,
} from '../../../src/components/recipes/recipe-card';
import { toCardRecipe } from '../../../src/lib/recipe/card-data';
import { html } from '../render';

const SOURCE = [
  '>> title: Dal',
  '>> time: 35 min',
  '>> difficulty: Easy',
  '>> protein: chicken',
  '',
  'Cook @chicken{200%g}.',
  '',
].join('\n');

describe('PhotoBlock', () => {
  it('is a tinted tile in the recipe colour without a cover', () => {
    const out = html(<PhotoBlock tone="marigold" />);
    expect(out).toContain('bg-marigold/30');
    expect(out).not.toContain('<img');
  });
});

describe('RecipeCard', () => {
  const recipe = toCardRecipe(
    { drive_file_id: 'dal', name: 'Dal.cook', source: SOURCE },
    false,
  );

  it('links to the recipe page', () => {
    expect(html(<RecipeCard recipe={recipe} />)).toContain(
      'href="/recipe/dal"',
    );
  });

  it('shows the facts the recipe has along the foot', () => {
    const out = html(<RecipeCard recipe={recipe} />);
    expect(out).toContain('35 min');
    expect(out).toContain('Easy');
    expect(out).toContain('Chicken');
  });

  it('leaves out the facts a recipe lacks', () => {
    const bare = toCardRecipe(
      { drive_file_id: 'x', name: 'X.cook', source: '>> title: X\n' },
      false,
    );
    expect(html(<RecipeCard recipe={bare} />)).not.toContain('text-[13px]');
  });

  it('draws a demo card’s heart as decoration: hidden, and not a control to tab to', () => {
    const out = html(<RecipeCard recipe={recipe} />);
    expect(out).not.toContain('<button');
    expect(out).not.toContain('aria-label="Add to favourites"');
    expect(out).toContain('aria-hidden="true"');
  });

  it('gives a live card a real heart button, beside the link and not inside it', () => {
    const out = html(<RecipeCard recipe={recipe} live />);
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain('aria-label="Add to favourites"');
    const link = out.slice(out.indexOf('<a '), out.indexOf('</a>'));
    expect(link).not.toContain('<button');
  });

  it('shows a live card’s heart as pressed for a favourite', () => {
    const loved = toCardRecipe(
      { drive_file_id: 'dal', name: 'Dal.cook', source: SOURCE },
      true,
    );
    const out = html(<RecipeCard recipe={loved} live />);
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('aria-label="Remove from favourites"');
  });

  it('marks a recipe that is only an idea', () => {
    const idea = { ...recipe, uncurated: true };
    expect(html(<RecipeCard recipe={idea} />)).toContain('>Idea<');
    expect(html(<RecipeCard recipe={recipe} />)).not.toContain('>Idea<');
  });

  it('is not painted until it scrolls near, and keeps its place meanwhile', () => {
    const out = html(<RecipeCard recipe={recipe} />);
    expect(out).toContain('[content-visibility:auto]');
    // Only the height is estimated; a width would widen an automatic column.
    expect(out).toContain(
      '[contain-intrinsic-block-size:auto_calc((100vw_-_2rem)*0.75_+_8.5rem)]',
    );
    expect(out).toContain('sm:[contain-intrinsic-block-size:auto_22rem]');
    expect(out).not.toContain('contain-intrinsic-size');
  });

  it('leaves room inside the skipped box for the focus ring, and takes it back in margin', () => {
    const out = html(<RecipeCard recipe={recipe} />);
    expect(out).toContain('<div class="-m-1.5 p-1.5 ');
  });

  it('paints an above-the-fold card at once', () => {
    const out = html(<RecipeCard recipe={recipe} priority />);
    expect(out).not.toContain('content-visibility');
    expect(out).not.toContain('-m-1.5');
  });

  it('lets the browser measure its lazy photo, with the grid’s columns as the fallback', () => {
    const covered = { ...recipe, cover: 'https://cdn.example.com/dal.jpg' };
    const out = html(<RecipeCard recipe={covered} />);
    expect(out).toContain(
      'sizes="auto, (min-width: 1700px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"',
    );
  });

  it('titles the card with the heading level it is given', () => {
    expect(html(<RecipeCard recipe={recipe} headingLevel="h2" />)).toMatch(
      /<h2[^>]*>Dal<\/h2>/,
    );
  });
});

describe('RecipeGrid', () => {
  it('holds its children', () => {
    expect(html(<RecipeGrid>hello</RecipeGrid>)).toContain('hello');
  });
});
