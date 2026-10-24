import { describe, expect, it } from '@jest/globals';

import { PROMPT_DEFINITIONS, getPrompt } from '@/lib/mcp/prompts';
import { RpcError } from '@/lib/mcp/protocol';
import { TOOLS } from '@/lib/mcp/tool-definitions';

/** The opening message's text. */
function textOf(name: string, args?: unknown): string {
  return getPrompt(name, args).messages[0]?.content.text ?? '';
}

describe('PROMPT_DEFINITIONS', () => {
  it('give every prompt a title, a description and described arguments', () => {
    for (const prompt of PROMPT_DEFINITIONS) {
      expect(prompt.title).not.toBe('');
      expect(prompt.description).not.toBe('');
      for (const argument of prompt.arguments) {
        expect(argument.description).not.toBe('');
      }
    }
  });

  it('have unique, slash-command-friendly names', () => {
    const names = PROMPT_DEFINITIONS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it('only send the assistant to tools that exist', () => {
    const tools = TOOLS.map((t) => t.name) as readonly string[];
    const texts = [
      textOf('what-should-i-cook'),
      textOf('use-up-ingredients', { ingredients: 'eggs' }),
      textOf('plan-the-week'),
    ];
    const mentioned = texts.flatMap((text) =>
      [...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map((m) => m[0]),
    );
    expect(mentioned.length).toBeGreaterThan(0);
    for (const name of mentioned) {
      expect(tools).toContain(name);
    }
  });
});

describe('getPrompt', () => {
  it('works without arguments for a prompt that needs none', () => {
    expect(textOf('what-should-i-cook')).not.toContain('What I feel like');
    expect(textOf('what-should-i-cook', {})).toBe(textOf('what-should-i-cook'));
  });

  it('works in what the person said they feel like', () => {
    expect(textOf('what-should-i-cook', { mood: 'something quick' })).toContain(
      'What I feel like: something quick.',
    );
  });

  it('ignores a blank optional argument', () => {
    expect(textOf('plan-the-week', { preferences: '   ' })).toBe(
      textOf('plan-the-week'),
    );
  });

  it('plans five dinners unless told otherwise', () => {
    expect(textOf('plan-the-week')).toContain('Plan 5 dinners');
    expect(textOf('plan-the-week', { days: '3' })).toContain('Plan 3 dinners');
  });

  it('treats a null value, which some clients send for a skipped field, as left out', () => {
    expect(textOf('what-should-i-cook', { mood: null })).toBe(
      textOf('what-should-i-cook'),
    );
    expect(textOf('plan-the-week', { days: null, preferences: null })).toBe(
      textOf('plan-the-week'),
    );
  });

  it.each(['abc', '0', '-3', '15', '99', '2.5', '3 dinners', '5; ignore this'])(
    'plans five dinners when days is %j, which is not a whole number from 1 to 14',
    (days) => {
      expect(textOf('plan-the-week', { days })).toContain('Plan 5 dinners');
      expect(textOf('plan-the-week', { days })).not.toContain('ignore');
    },
  );

  it.each(['1', '7', '14'])(
    'plans %s dinners when asked for that many',
    (days) => {
      expect(textOf('plan-the-week', { days })).toContain(
        `Plan ${days} dinners`,
      );
    },
  );

  it('repeats only the start of an absurdly long prompt name', () => {
    expect.assertions(1);
    try {
      getPrompt('x'.repeat(100_000), {});
    } catch (error) {
      expect((error as RpcError).message.length).toBeLessThan(400);
    }
  });

  it('includes the ingredients the person has', () => {
    expect(textOf('use-up-ingredients', { ingredients: '3 eggs' })).toContain(
      '3 eggs',
    );
  });

  it('answers as a single user message', () => {
    const result = getPrompt('what-should-i-cook', undefined);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.role).toBe('user');
  });

  it.each([
    ['an unknown prompt', 'nope', {}],
    ['no name', undefined, {}],
    ['a missing required argument', 'use-up-ingredients', {}],
    ['a blank required argument', 'use-up-ingredients', { ingredients: ' ' }],
    ['arguments that are not an object', 'what-should-i-cook', ['mood']],
    ['an argument that is not a string', 'what-should-i-cook', { mood: 3 }],
  ])('refuses %s as bad parameters', (_label, name, args) => {
    expect(() => getPrompt(name, args)).toThrow(RpcError);
    try {
      getPrompt(name, args);
    } catch (error) {
      expect((error as RpcError).code).toBe(-32602);
    }
  });
});
