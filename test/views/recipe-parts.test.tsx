import { describe, expect, it } from '@jest/globals';

import type { RecipeCardData } from '@/domain/mcp/ui-types';
import { Eyebrow, FullRecipe, MetaRow, Step } from '@/views/recipe-parts';
import { html } from '../components/render';

const RECIPE: RecipeCardData = {
  id: 'r1',
  title: 'Pasta al Limone',
  uncurated: false,
  source: 'https://example.com/pasta',
  metadata: [
    ['servings', '4'],
    ['time', '20 min'],
  ],
  ingredients: [
    { name: 'pasta', quantity: '200 g' },
    { name: 'lemon', quantity: '' },
  ],
  cookware: ['large pot'],
  steps: [
    [
      { kind: 'text', text: 'Boil ' },
      { kind: 'ingredient', name: 'pasta', quantity: '200 g' },
      { kind: 'text', text: ' in a ' },
      { kind: 'cookware', name: 'large pot' },
      { kind: 'text', text: ' for ' },
      { kind: 'timer', label: '10 minutes' },
    ],
  ],
  logs: [{ date: '2026-01-02', note: 'Used less salt' }],
};

describe('Eyebrow', () => {
  it('says whether it is a recipe or an idea', () => {
    expect(html(<Eyebrow uncurated={false} />)).toContain('Recipe<');
    expect(html(<Eyebrow uncurated />)).toContain('Recipe idea');
  });
});

describe('MetaRow', () => {
  it('lists the facts with separators between them', () => {
    const out = html(<MetaRow metadata={RECIPE.metadata} />);
    expect(out).toContain('<b>servings</b> 4');
    expect(out).toContain('<b>time</b> 20 min');
    expect(out.match(/class="sep"/g)).toHaveLength(1);
  });

  it('draws nothing when there are none', () => {
    expect(html(<MetaRow metadata={[]} />)).toBe('');
  });
});

describe('Step', () => {
  const out = html(<Step tokens={RECIPE.steps[0] ?? []} />);

  it('highlights each kind of token', () => {
    expect(out).toContain('tok-ing');
    expect(out).toContain('tok-cook');
    expect(out).toContain('tok-timer');
    expect(out).toContain('10 minutes');
  });

  it('shows the ingredient amount as text, not only as a tooltip', () => {
    expect(out).toContain('(200 g)');
    expect(out).not.toContain('title=');
  });
});

describe('FullRecipe', () => {
  it('shows ingredients, cookware, method and log with real list markup', () => {
    const out = html(<FullRecipe recipe={RECIPE} />);
    expect(out).toContain('Pasta al Limone');
    expect(out).toContain('<ul class="ings">');
    expect(out).toContain('large pot');
    expect(out).toContain('<ol class="steps">');
    expect(out).toContain('Used less salt');
  });

  it('is labelled and can take keyboard focus', () => {
    const out = html(<FullRecipe recipe={RECIPE} />);
    expect(out).toContain('aria-labelledby="recipe-title"');
    expect(out).toContain('tabindex="-1"');
  });

  it('offers a way back only when it can go back', () => {
    expect(html(<FullRecipe recipe={RECIPE} />)).not.toContain('Back');
    expect(
      html(<FullRecipe recipe={RECIPE} onBack={() => undefined} />),
    ).toContain('Back');
  });

  it('offers the source link only through a host that can open links', () => {
    expect(html(<FullRecipe recipe={RECIPE} />)).not.toContain(
      'original recipe',
    );
    expect(
      html(<FullRecipe recipe={RECIPE} onOpenLink={() => undefined} />),
    ).toContain('Open the original recipe');
  });

  it('never offers a source that is not a web link', () => {
    const out = html(
      <FullRecipe
        recipe={{ ...RECIPE, source: 'javascript:alert(1)' }}
        onOpenLink={() => undefined}
      />,
    );
    expect(out).not.toContain('original recipe');
    expect(out).not.toContain('javascript:');
  });

  it('numbers the steps for people who cannot see the circle', () => {
    const out = html(<FullRecipe recipe={RECIPE} />);
    expect(out).toContain('<span class="sr-only">Step </span>1');
    expect(out).not.toContain('class="num" aria-hidden');
  });

  it('says which site the source link leads to', () => {
    expect(
      html(<FullRecipe recipe={RECIPE} onOpenLink={() => undefined} />),
    ).toContain('Open the original recipe on example.com');
  });

  it('says where to leave fullscreen when the host would not take Back', () => {
    const out = html(
      <FullRecipe recipe={RECIPE} onBack={() => undefined} closeHint />,
    );
    expect(out).toContain('Use the close button in the header');
    expect(
      html(<FullRecipe recipe={RECIPE} onBack={() => undefined} />),
    ).not.toContain('close button');
  });

  it('does not use anchors with targets for links', () => {
    expect(
      html(<FullRecipe recipe={RECIPE} onOpenLink={() => undefined} />),
    ).not.toContain('<a ');
  });
});
