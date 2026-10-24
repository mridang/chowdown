import { describe, expect, it } from '@jest/globals';

import { parseRecipe } from '@/lib/cooklang/cooklang';

import {
  extractOgImage,
  extractRecipeFromHtml,
  findRecipeNode,
  humaniseDuration,
  imageUrls,
  resolveImageRefs,
  schemaOrgToCook,
} from '@/lib/recipe/import-schema-org';

describe('humaniseDuration', () => {
  it('formats hours and minutes', () => {
    expect(humaniseDuration('PT1H30M')).toBe('1 hr 30 min');
    expect(humaniseDuration('PT40M')).toBe('40 min');
    expect(humaniseDuration('PT2H')).toBe('2 hr');
  });

  it('returns undefined for junk', () => {
    expect(humaniseDuration('nonsense')).toBeUndefined();
  });
});

describe('findRecipeNode', () => {
  it('finds a Recipe inside a @graph', () => {
    const node = findRecipeNode({
      '@graph': [{ '@type': 'WebSite' }, { '@type': 'Recipe', name: 'X' }],
    });
    expect(node?.['name']).toBe('X');
  });

  it('handles @type as an array', () => {
    expect(findRecipeNode({ '@type': ['Thing', 'Recipe'], name: 'Y' })).toEqual(
      { '@type': ['Thing', 'Recipe'], name: 'Y' },
    );
  });

  it('returns null when absent', () => {
    expect(findRecipeNode({ '@type': 'Article' })).toBeNull();
  });
});

describe('schemaOrgToCook', () => {
  const recipe = {
    '@type': 'Recipe',
    name: 'Pancakes',
    recipeYield: '4',
    totalTime: 'PT20M',
    keywords: 'breakfast',
    recipeIngredient: ['200 g flour', '2 eggs', 'pinch salt'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Mix everything.' },
      { '@type': 'HowToStep', text: 'Fry in a pan.' },
    ],
  };

  const cook = schemaOrgToCook(recipe, 'https://example.com/pancakes');

  it('writes metadata', () => {
    expect(cook).toContain('>> title: Pancakes');
    expect(cook).toContain('>> servings: 4');
    expect(cook).toContain('>> time: 20 min');
    expect(cook).toContain('>> keywords: breakfast');
    expect(cook).toContain('>> source: https://example.com/pancakes');
  });

  it('keeps each metadata value on one line, whatever the page put in it', () => {
    const out = schemaOrgToCook(
      {
        '@type': 'Recipe',
        name: 'Pancakes\n>> source: https://evil.example',
        recipeYield: '4\r\n>> servings: 99',
        recipeInstructions: 'Cook it.',
      },
      'https://ex.com/p',
    );
    const meta = out.split('\n').filter((l) => l.startsWith('>>'));
    expect(meta.filter((l) => l.startsWith('>> source:'))).toEqual([
      '>> source: https://ex.com/p',
    ]);
    expect(meta.filter((l) => l.startsWith('>> servings:'))).toHaveLength(1);
  });

  it('captures taxonomy, provenance and media', () => {
    const out = schemaOrgToCook(
      {
        '@type': 'Recipe',
        name: 'Butter Chicken',
        recipeCuisine: 'Indian',
        recipeCategory: 'Main course',
        cookingMethod: 'Simmering',
        suitableForDiet: ['http://schema.org/GlutenFreeDiet', 'HalalDiet'],
        prepTime: 'PT15M',
        datePublished: '2024-06-01',
        author: { '@type': 'Person', name: 'Asma Khan' },
        image: ['https://ex.com/a.jpg', { url: 'https://ex.com/b.jpg' }],
        video: { '@type': 'VideoObject', contentUrl: 'https://ex.com/v.mp4' },
        recipeInstructions: 'Cook it.',
      },
      'https://ex.com/butter-chicken',
    );
    expect(out).toContain('>> cuisine: Indian');
    expect(out).toContain('>> category: Main course');
    expect(out).toContain('>> method: Simmering');
    expect(out).toContain('>> diet: GlutenFree, Halal');
    expect(out).toContain('>> prep: 15 min');
    expect(out).toContain('>> author: Asma Khan');
    expect(out).toContain('>> published: 2024-06-01');
    expect(out).toContain(
      '>> images: https://ex.com/a.jpg https://ex.com/b.jpg',
    );
    expect(out).toContain('>> video: https://ex.com/v.mp4');
  });

  it('emits ingredient tokens and steps', () => {
    expect(cook).toContain('@flour{200%g}');
    expect(cook).toContain('@eggs{2}');
    expect(cook).toContain('Mix everything.');
    expect(cook).toContain('Fry in a pan.');
  });

  it('handles instructions given as a single string', () => {
    const out = schemaOrgToCook({
      '@type': 'Recipe',
      name: 'Toast',
      recipeInstructions: 'Toast bread.\nButter it.',
    });
    expect(out).toContain('Toast bread.');
    expect(out).toContain('Butter it.');
  });
});

describe('extractRecipeFromHtml', () => {
  it('pulls a Recipe out of a ld+json script tag', () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Soup","recipeInstructions":"Boil it."}
      </script>
      </head></html>`;
    const cook = extractRecipeFromHtml(html, 'https://x.test/soup');
    expect(cook).toContain('>> title: Soup');
    expect(cook).toContain('Boil it.');
  });

  it('skips malformed json and returns null when no recipe', () => {
    const html = `<script type="application/ld+json">{ not json }</script>`;
    expect(extractRecipeFromHtml(html)).toBeNull();
  });
});

describe('extractOgImage', () => {
  it('reads og:image with property before content', () => {
    const html =
      '<meta property="og:image" content="https://a.com/p.jpg?x=1&amp;y=2">';
    expect(extractOgImage(html)).toBe('https://a.com/p.jpg?x=1&y=2');
  });

  it('reads og:image with content before property', () => {
    const html = '<meta content="https://a.com/p.jpg" property="og:image" />';
    expect(extractOgImage(html)).toBe('https://a.com/p.jpg');
  });

  it('resolves a relative image against the base url', () => {
    const html = '<meta property="og:image" content="/img/p.jpg">';
    expect(extractOgImage(html, 'https://a.com/post/x')).toBe(
      'https://a.com/img/p.jpg',
    );
  });

  it('rejects non-http schemes', () => {
    const html = '<meta property="og:image" content="javascript:alert(1)">';
    expect(extractOgImage(html)).toBeUndefined();
  });

  it('is undefined when the page has no og:image', () => {
    expect(extractOgImage('<html><head></head></html>')).toBeUndefined();
  });
});

describe('imageUrls', () => {
  it('encodes spaces and drops placeholder and invalid urls', () => {
    expect(
      imageUrls([
        'https://a.com/My Photo.jpg',
        'https://a.com/undefined',
        'not a url',
        { url: 'https://a.com/ok.jpg' },
      ] as never),
    ).toEqual(['https://a.com/My%20Photo.jpg', 'https://a.com/ok.jpg']);
  });
});

describe('image references', () => {
  const html = (blocks: unknown[]): string =>
    blocks
      .map(
        (b) =>
          `<script type="application/ld+json">${JSON.stringify(b)}</script>`,
      )
      .join('');
  const recipe = {
    '@type': 'Recipe',
    name: 'Ref Recipe',
    recipeIngredient: ['1 egg'],
    recipeInstructions: ['Boil it.'],
  };

  it('follows an @id reference to an ImageObject in the same @graph', () => {
    const out = extractRecipeFromHtml(
      html([
        {
          '@graph': [
            {
              '@type': 'ImageObject',
              '@id': '#hero',
              url: 'https://a.com/hero.jpg',
            },
            { ...recipe, image: { '@id': '#hero' } },
          ],
        },
      ]),
    );
    expect(out).toContain('>> images: https://a.com/hero.jpg');
  });

  it('follows a reference to an ImageObject in a different script block', () => {
    const out = extractRecipeFromHtml(
      html([
        {
          '@type': 'ImageObject',
          '@id': '#hero',
          url: 'https://a.com/hero.jpg',
        },
        { ...recipe, image: [{ '@id': '#hero' }] },
      ]),
    );
    expect(out).toContain('>> images: https://a.com/hero.jpg');
  });

  it('leaves an unresolvable reference alone without failing', () => {
    const out = extractRecipeFromHtml(
      html([{ ...recipe, image: { '@id': '#missing' } }]),
    );
    expect(out).toContain('>> title: Ref Recipe');
    expect(out).not.toContain('images:');
  });

  it('resolveImageRefs only replaces pure reference objects', () => {
    const byId = new Map([['#a', { '@id': '#a', url: 'https://a.com/1.jpg' }]]);
    const kept = resolveImageRefs(
      { image: { '@id': '#a', url: 'https://a.com/own.jpg' } },
      byId,
    );
    expect(kept['image']).toEqual({
      '@id': '#a',
      url: 'https://a.com/own.jpg',
    });
  });
});

/** How long `work` takes, in milliseconds. */
function milliseconds(work: () => unknown): number {
  const started = performance.now();
  work();
  return performance.now() - started;
}

describe('hostile pages', () => {
  const pages: Readonly<Record<string, string>> = {
    'meta tags with a content and nothing else': '<meta content="a" '.repeat(
      2000,
    ),
    'script starts that never end': '<script '.repeat(25_000),
    'script starts with attributes': '<script a=b '.repeat(16_000),
    'ld+json scripts that never close':
      '<script type="application/ld+json">'.repeat(30_000),
    'a megabyte of unterminated ld+json': `<script type="application/ld+json">${'{'.repeat(1_000_000)}`,
  };

  it.each(Object.entries(pages))(
    'extractOgImage reads %s in under 100 ms',
    (_name, page) => {
      expect(milliseconds(() => extractOgImage(page))).toBeLessThan(100);
      expect(extractOgImage(page)).toBeUndefined();
    },
  );

  it.each(Object.entries(pages))(
    'extractRecipeFromHtml reads %s in under 100 ms',
    (_name, page) => {
      expect(milliseconds(() => extractRecipeFromHtml(page))).toBeLessThan(100);
      expect(extractRecipeFromHtml(page)).toBeNull();
    },
  );

  it('still finds the recipe in a page that also holds hostile tags', () => {
    const page = `${'<script '.repeat(1000)}<script type="application/ld+json">${JSON.stringify(
      { '@type': 'Recipe', name: 'Found' },
    )}</script>`;
    expect(extractRecipeFromHtml(page)).toContain('>> title: Found');
  });

  it('gives up on JSON-LD nested far deeper than any real page, without crashing', () => {
    const deep = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    const page = `<script type="application/ld+json">${deep}</script>`;
    expect(milliseconds(() => extractRecipeFromHtml(page))).toBeLessThan(500);
    expect(extractRecipeFromHtml(page)).toBeNull();
  });

  it('finds a recipe in a @graph a few levels down', () => {
    const page = `<script type="application/ld+json">${JSON.stringify([
      { '@graph': [{ '@graph': [{ '@type': 'Recipe', name: 'Nested' }] }] },
    ])}</script>`;
    expect(extractRecipeFromHtml(page)).toContain('>> title: Nested');
  });
});

describe('extractOgImage markup', () => {
  it('accepts name= as well as property=, unquoted values and any case', () => {
    expect(
      extractOgImage('<META NAME=og:IMAGE CONTENT=https://a.com/p.jpg>'),
    ).toBe('https://a.com/p.jpg');
  });

  it('prefers og:image:secure_url when it comes first', () => {
    const html =
      '<meta property="og:image:secure_url" content="https://a.com/s.jpg"><meta property="og:image" content="https://a.com/p.jpg">';
    expect(extractOgImage(html)).toBe('https://a.com/s.jpg');
  });

  it('ignores og:image:width and empty content', () => {
    expect(
      extractOgImage(
        '<meta property="og:image:width" content="600"><meta property="og:image" content="">',
      ),
    ).toBeUndefined();
  });

  it('does not read a tag that sits inside a script', () => {
    expect(
      extractOgImage(
        '<script>x = \'<meta property="og:image" content="https://a.com/p.jpg">\'</script>',
      ),
    ).toBeUndefined();
  });
});

describe('an imported recipe read back', () => {
  const imported = schemaOrgToCook({
    '@type': 'Recipe',
    name: 'Chicken Fajitas',
    recipeIngredient: [
      '1/4 cup / 65 ml lime juice',
      '2 garlic cloves (, minced)',
      '700g / 1.2 lb skinless chicken thighs (, halved (Note 2))',
      '8– 12 small tortillas',
      'Lamb stew meat, 1000 g',
      'Salt, to taste',
      '½ tbsp fresh ginger',
    ],
    recipeInstructions: ['Marinate the chicken.', 'Cook it hot and fast.'],
  });
  const recipe = parseRecipe(imported, 'fajitas.cook');

  it('has the ingredients with their quantities in the ingredients panel', () => {
    expect(recipe.ingredients).toEqual([
      { name: 'lime juice', quantity: '1/4 cup' },
      { name: 'garlic cloves', quantity: '2' },
      { name: 'skinless chicken thighs', quantity: '700 g' },
      { name: 'small tortillas', quantity: '8-12' },
      { name: 'Lamb stew meat', quantity: '1000 g' },
      { name: 'Salt', quantity: 'to taste' },
      { name: 'fresh ginger', quantity: '1/2 tbsp' },
    ]);
  });

  it('starts its method with the first instruction, not with the ingredients again', () => {
    expect(recipe.steps).toEqual([
      [{ kind: 'text', text: 'Marinate the chicken.' }],
      [{ kind: 'text', text: 'Cook it hot and fast.' }],
    ]);
  });
});

describe('the author of an imported recipe', () => {
  const recipeNode = {
    '@type': 'Recipe',
    name: 'Fajitas',
    recipeIngredient: ['1 onion'],
    recipeInstructions: ['Cook it.'],
  };
  const html = (graph: unknown, head = '') =>
    `<html><head>${head}<script type="application/ld+json">${JSON.stringify(graph)}</script></head></html>`;

  it("is read from the page's Article when the Recipe names nobody", () => {
    const cook = extractRecipeFromHtml(
      html({
        '@graph': [
          recipeNode,
          { '@type': 'Article', author: { '@id': '#nagi' } },
          { '@type': 'Person', '@id': '#nagi', name: 'Nagi' },
        ],
      }),
    );
    expect(cook).toContain('>> author: Nagi');
  });

  it('is read from a meta tag when the structured data has none', () => {
    expect(
      extractRecipeFromHtml(
        html(recipeNode, '<meta name="author" content="Liz Marino">'),
      ),
    ).toContain('>> author: Liz Marino');
  });

  it("keeps the Recipe's own author over any other", () => {
    const cook = extractRecipeFromHtml(
      html(
        {
          '@graph': [
            { ...recipeNode, author: { name: 'Marion Grasby' } },
            { '@type': 'Article', author: { name: 'Someone Else' } },
          ],
        },
        '<meta name="author" content="Liz Marino">',
      ),
    );
    expect(cook).toContain('>> author: Marion Grasby');
    expect(cook).not.toContain('Someone Else');
  });

  it('is left out when the page gives no name a person could have', () => {
    expect(
      extractRecipeFromHtml(
        html(recipeNode, '<meta name="author" content="admin">'),
      ),
    ).not.toContain('>> author:');
  });
});
