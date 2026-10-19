import { describe, expect, it } from '@jest/globals';

import {
  LIST_TEXT_LIMIT,
  cardText,
  listText,
} from '../../../src/lib/mcp/tool-text';
import { buildRecipeCardData } from '../../../src/lib/mcp/tool-results';

const SOURCE = [
  '>> servings: 4',
  '>> time: 20 min',
  '>> source: https://example.com/pancakes',
  '',
  'Mix @flour{200%g} with @eggs{2} and @salt{} in a #bowl{}.',
  '',
  'Fry for ~{3%minutes}.',
  '',
  '-- [cook 2026-01-02] Added vanilla',
].join('\n');

describe('listText', () => {
  it('prints one line per recipe with its id, and marks ideas', () => {
    expect(
      listText([
        { id: 'a', title: 'Soup', uncurated: false },
        { id: 'b', title: 'Paneer', uncurated: true },
      ]),
    ).toBe('- Soup (id: a)\n- Paneer (idea, id: b)');
  });

  it('is empty for no recipes', () => {
    expect(listText([])).toBe('');
  });

  it('stops at the limit and says how many were left out', () => {
    const many = Array.from({ length: LIST_TEXT_LIMIT + 3 }, (_, i) => ({
      id: String(i),
      title: `R${i}`,
      uncurated: false,
    }));
    const lines = listText(many).split('\n');
    expect(lines).toHaveLength(LIST_TEXT_LIMIT + 1);
    expect(lines.at(-1)).toBe(
      '…and 3 more not shown (search by name to find one).',
    );
  });
});

describe('cardText', () => {
  const card = buildRecipeCardData('id1', 'Pancakes.cook', SOURCE);
  const text = cardText(card);

  it('opens with the title and id, then the details and the source', () => {
    expect(text.split('\n').slice(0, 3)).toEqual([
      'Pancakes (id: id1)',
      'servings: 4; time: 20 min',
      'Source: https://example.com/pancakes',
    ]);
  });

  it('lists the ingredients with their quantities', () => {
    expect(text).toContain('Ingredients:\n- 200 g flour\n- 2 eggs\n- salt');
  });

  it('numbers the method, spelling ingredients with their amounts', () => {
    expect(text).toContain(
      'Method:\n1. Mix 200 g flour with 2 eggs and salt in a bowl.\n2. Fry for 3 minutes.',
    );
  });

  it('lists the cookware', () => {
    expect(text).toContain('Cookware:\nbowl');
  });

  it('lists the cooking log', () => {
    expect(text).toContain('Cooking log:\n- 2026-01-02: Added vanilla');
  });

  it('leaves out sections that are empty and says when a recipe is an idea', () => {
    const idea = cardText({
      ...buildRecipeCardData('id2', 'Idea.cook', 'Just a thought.'),
      uncurated: true,
    });
    expect(idea).toBe(
      'Idea (idea, not yet a full recipe, id: id2)\n\nMethod:\n1. Just a thought.',
    );
  });

  it('keeps only the latest cooking-log entries', () => {
    const logs = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      note: `n${i}`,
    }));
    const lines = cardText({ ...card, logs }).split('\n');
    expect(lines.filter((l) => l.startsWith('- 2026-'))).toHaveLength(10);
    expect(lines.at(-1)).toBe('- 2026-01-14: n13');
  });

  it('cuts off a recipe that is unreasonably long', () => {
    const long = {
      ...card,
      steps: [[{ kind: 'text' as const, text: 'stir '.repeat(5000) }]],
    };
    const cut = cardText(long);
    expect(cut.length).toBeLessThan(12_100);
    expect(cut.endsWith('…(recipe text cut short)')).toBe(true);
  });
});
