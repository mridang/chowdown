import { describe, expect, it } from '@jest/globals';

import {
  heroCrumbs,
  heroEyebrow,
  RecipeHero,
} from '../../../../../../src/app/(site)/recipe/[id]/_components/recipe-hero';
import { htmlAt } from '../../../../../components/render';

describe('heroCrumbs', () => {
  it('starts at the list of recipes', () => {
    expect(heroCrumbs(undefined)).toEqual([{ label: 'Recipes', href: '/app' }]);
  });

  it('adds the cuisine, linking to that cuisine in the list', () => {
    expect(heroCrumbs('south indian')).toEqual([
      { label: 'Recipes', href: '/app' },
      { label: 'South indian', href: '/app?cuisine=south%20indian' },
    ]);
  });
});

describe('heroEyebrow', () => {
  it('joins the cuisine and the course', () => {
    expect(heroEyebrow('indian', 'dinner')).toBe('Indian · Dinner');
  });

  it('shows whichever of the two the recipe has', () => {
    expect(heroEyebrow('indian', undefined)).toBe('Indian');
    expect(heroEyebrow(undefined, 'dinner')).toBe('Dinner');
  });

  it('is undefined when the recipe has neither', () => {
    expect(heroEyebrow(undefined, undefined)).toBeUndefined();
    expect(heroEyebrow('', '')).toBeUndefined();
  });
});

describe('RecipeHero', () => {
  const steps = [[{ kind: 'text' as const, text: 'Chop.' }]];
  const markup = (over: Partial<Parameters<typeof RecipeHero>[0]> = {}) =>
    htmlAt(
      <RecipeHero
        recipeId="dal"
        title="Dal"
        images={[]}
        tone="forest"
        cuisine="indian"
        course="dinner"
        steps={steps}
        favourite={false}
        {...over}
      />,
      { pathname: '/recipe/dal' },
    );

  it('titles the page with the recipe in the one level-one heading', () => {
    const out = markup();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Dal<\/h1>/);
  });

  it('puts a breadcrumb trail above the title, ending at the cuisine', () => {
    const out = markup();
    expect(out).toContain('aria-label="Breadcrumb"');
    expect(out).toContain('<ol');
    expect(out).toContain('href="/app?cuisine=indian"');
    expect(out).toContain('>Indian</a>');
  });

  it('shows the cuisine and the course above the title', () => {
    expect(markup()).toContain('Indian · Dinner');
  });

  it('offers the actions: cook mode, favourite, share and more', () => {
    const out = markup();
    expect(out).toContain('Cook mode');
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain('>Share</button>');
    expect(out).toContain('aria-label="More actions"');
  });

  it('leaves out cook mode for a recipe with no steps', () => {
    expect(markup({ steps: [] })).not.toContain('Cook mode');
  });

  it('links to the video only when there is one', () => {
    expect(markup()).not.toContain('Watch the video');
    expect(markup({ video: 'https://example.com/v' })).toContain(
      'Watch the video',
    );
  });

  it('shows the heart as pressed for a favourite', () => {
    expect(markup({ favourite: true })).toContain('>Favourited</button>');
  });

  it('puts the source and the author in the hero, under the title', () => {
    const out = markup({
      sourceUrl: 'https://cookwell.com/recipe/dal',
      author: 'Ethan Chlebowski',
    });
    expect(out).toMatch(
      /<\/h1>.*From.*cookwell\.com.*by.*Ethan Chlebowski.*More from cookwell\.com/,
    );
  });

  it('sets only the author in the handwriting face', () => {
    const out = markup({
      sourceUrl: 'https://cookwell.com/recipe/dal',
      author: 'Ethan Chlebowski',
    });
    expect(out.match(/font-hand/g)).toHaveLength(1);
    expect(out).toMatch(/class="font-hand[^"]*"[^>]*>Ethan Chlebowski</);
  });

  it('shows the source alone, the author alone, or neither', () => {
    expect(markup({ sourceUrl: 'https://cookwell.com/x' })).not.toContain(
      'font-hand',
    );
    expect(markup({ author: 'Ethan' })).toContain('>By<');
    const neither = markup();
    expect(neither).not.toContain('font-hand');
    expect(neither).not.toContain('From');
  });
});
