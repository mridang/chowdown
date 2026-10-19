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

  const SOURCE = 'https://cookwell.com/recipe/dal';
  const at = (out: string, text: string) => out.indexOf(text);

  it('puts "by <author>" directly under the title, before the actions and the source', () => {
    const out = markup({ sourceUrl: SOURCE, author: 'Ethan Chlebowski' });
    expect(at(out, '</h1>')).toBeLessThan(at(out, 'Ethan Chlebowski'));
    expect(at(out, 'Ethan Chlebowski')).toBeLessThan(at(out, 'Cook mode'));
    expect(at(out, 'Cook mode')).toBeLessThan(at(out, '>From<'));
    expect(at(out, '>From<')).toBeLessThan(at(out, 'More from cookwell.com'));
  });

  it('keeps the present look and links of the source line', () => {
    const out = markup({ sourceUrl: SOURCE, author: 'Ethan Chlebowski' });
    expect(out).toContain(`href="${SOURCE}"`);
    expect(out).toContain('href="/app?site=cookwell.com"');
  });

  it('sets only the author in the handwriting face', () => {
    const out = markup({ sourceUrl: SOURCE, author: 'Ethan Chlebowski' });
    expect(out.match(/font-hand-/g)).toHaveLength(1);
    expect(out).toMatch(/font-hand-\w+[^"]*"[^>]*>Ethan Chlebowski</);
  });

  it('keeps the source line under the title when there is no author', () => {
    const out = markup({ sourceUrl: SOURCE });
    expect(at(out, '</h1>')).toBeLessThan(at(out, '>From<'));
    expect(at(out, '>From<')).toBeLessThan(at(out, 'Cook mode'));
    expect(out).not.toContain('font-hand');
  });

  it('puts the video link with the source line, wherever that sits', () => {
    const withAuthor = markup({
      sourceUrl: SOURCE,
      author: 'Ethan',
      video: 'https://example.com/v',
    });
    expect(at(withAuthor, 'Cook mode')).toBeLessThan(
      at(withAuthor, 'Watch the video'),
    );
    const without = markup({ video: 'https://example.com/v' });
    expect(at(without, 'Watch the video')).toBeLessThan(
      at(without, 'Cook mode'),
    );
  });

  it('shows the author alone with no source line and no gap', () => {
    const out = markup({ author: 'Ethan' });
    expect(out).toMatch(/>by<.*Ethan/);
    expect(out).not.toContain('>From<');
  });

  it('shows neither when the recipe has no source and no author', () => {
    const out = markup();
    expect(out).not.toContain('font-hand');
    expect(out).not.toContain('From');
    expect(out).not.toContain('Find the author');
  });
});

describe('RecipeHero\'s "Find the author"', () => {
  const steps = [[{ kind: 'text' as const, text: 'Chop.' }]];
  const markup = (over: Partial<Parameters<typeof RecipeHero>[0]> = {}) =>
    htmlAt(
      <RecipeHero
        recipeId="dal"
        title="Dal"
        images={[]}
        tone="forest"
        steps={steps}
        favourite={false}
        sourceUrl="https://cookwell.com/recipe/dal"
        driveConnected
        {...over}
      />,
      { pathname: '/recipe/dal' },
    );

  it('stands where the author line would, under the title and before the actions', () => {
    const out = markup();
    expect(out.indexOf('</h1>')).toBeLessThan(out.indexOf('Find the author'));
    expect(out.indexOf('Find the author')).toBeLessThan(
      out.indexOf('Cook mode'),
    );
    expect(out.indexOf('Cook mode')).toBeLessThan(out.indexOf('>From<'));
  });

  it('is left out once the recipe has an author', () => {
    expect(markup({ author: 'Ada' })).not.toContain('Find the author');
  });

  it('is left out when there is no source page to read', () => {
    expect(markup({ sourceUrl: undefined })).not.toContain('Find the author');
    expect(
      markup({ sourceUrl: 'not a url', sourceText: 'Grandma' }),
    ).not.toContain('Find the author');
  });

  it('is left out when Drive is not connected', () => {
    expect(markup({ driveConnected: false })).not.toContain('Find the author');
  });
});
