import { describe, expect, it } from '@jest/globals';

import {
  buildFacts,
  RecipeFacts,
} from '@/app/(site)/recipe/[id]/_components/recipe-facts';
import { html } from '../../../../../components/render';

const labels = (facts: ReturnType<typeof buildFacts>) =>
  facts.map((fact) => fact.label);

const FULL_TAGS = {
  difficulty: ['Easy'],
  protein: ['chicken'],
  cuisine: ['indian'],
  category: ['dinner'],
  method: ['stovetop', 'oven'],
  diet_type: ['Non-vegetarian'],
  diet: ['Gluten-free', 'Dairy-free'],
};

describe('buildFacts', () => {
  it('has nothing for a recipe that says nothing', () => {
    expect(buildFacts({ tags: {} })).toEqual([]);
  });

  it('lists every fact the recipe has, in the page order', () => {
    expect(
      labels(buildFacts({ minutes: 35, serves: 4, tags: FULL_TAGS })),
    ).toEqual([
      'Total time',
      'Serves',
      'Difficulty',
      'Protein',
      'Cuisine',
      'Course',
      'Method',
      'Eating style',
      'Diet',
    ]);
  });

  it('leaves out each fact the recipe lacks', () => {
    expect(
      labels(buildFacts({ serves: 2, tags: { cuisine: ['thai'] } })),
    ).toEqual(['Serves', 'Cuisine']);
  });

  it('keeps a time of zero minutes and zero servings, which are still stated', () => {
    expect(labels(buildFacts({ minutes: 0, serves: 0, tags: {} }))).toEqual([
      'Total time',
      'Serves',
    ]);
  });

  it('words the values for reading', () => {
    const values = Object.fromEntries(
      buildFacts({ minutes: 90, serves: 4, tags: FULL_TAGS }).map((fact) => [
        fact.label,
        fact.value,
      ]),
    );
    expect(values['Total time']).toBe('1 h 30');
    expect(values['Serves']).toBe(4);
    expect(values['Protein']).toBe('Chicken');
    expect(values['Cuisine']).toBe('Indian');
    expect(values['Course']).toBe('Dinner');
    expect(values['Method']).toBe('Stovetop, Oven');
    expect(values['Diet']).toBe('Gluten-free, Dairy-free');
  });
});

describe('RecipeFacts', () => {
  it('draws no list when there are no facts', () => {
    expect(html(<RecipeFacts facts={[]} />)).toBe('');
  });

  it('draws each fact as a term and its value in one definition list', () => {
    const out = html(
      <RecipeFacts facts={buildFacts({ minutes: 35, serves: 4, tags: {} })} />,
    );
    expect(out).toContain('<dl');
    expect(out.match(/<dt/g)).toHaveLength(2);
    expect(out).toContain('Total time');
    expect(out).toContain('35 min');
    expect(out).toContain('Serves');
  });
});
