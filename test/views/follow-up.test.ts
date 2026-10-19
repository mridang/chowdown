import { describe, expect, it } from '@jest/globals';

import {
  firstThatWorks,
  followUpChannels,
  openRecipePrompt,
  safeHttpUrl,
} from '../../src/views/follow-up';

describe('followUpChannels', () => {
  it('uses ChatGPT’s bridge first inside ChatGPT, then the standard message', () => {
    expect(followUpChannels({ connected: true, openAiFollowUp: true })).toEqual(
      ['openai', 'mcp-message'],
    );
  });

  it('uses the standard ui/message outside ChatGPT, so tiles work in Claude and others', () => {
    expect(
      followUpChannels({ connected: true, openAiFollowUp: false }),
    ).toEqual(['mcp-message']);
  });

  it('has no route before the handshake and without ChatGPT’s bridge', () => {
    expect(
      followUpChannels({ connected: false, openAiFollowUp: false }),
    ).toEqual([]);
    expect(
      followUpChannels({ connected: false, openAiFollowUp: true }),
    ).toEqual(['openai']);
  });
});

describe('firstThatWorks', () => {
  it('stops at the first route that works', async () => {
    const tried: string[] = [];
    const used = await firstThatWorks(['openai', 'mcp-message'], (channel) => {
      tried.push(channel);
      return Promise.resolve(true);
    });
    expect(used).toBe('openai');
    expect(tried).toEqual(['openai']);
  });

  it('falls through when a route fails or throws', async () => {
    const used = await firstThatWorks(['openai', 'mcp-message'], (channel) =>
      channel === 'openai'
        ? Promise.reject(new Error('host said no'))
        : Promise.resolve(true),
    );
    expect(used).toBe('mcp-message');
  });

  it('reports that nothing worked', async () => {
    expect(
      await firstThatWorks(['mcp-message'], () => Promise.resolve(false)),
    ).toBeUndefined();
    expect(
      await firstThatWorks([], () => Promise.resolve(true)),
    ).toBeUndefined();
  });
});

describe('openRecipePrompt', () => {
  it('asks the assistant to open the recipe by its title', () => {
    expect(openRecipePrompt('Pasta al Limone')).toBe(
      'Open the "Pasta al Limone" recipe',
    );
  });
});

describe('safeHttpUrl', () => {
  it('passes web links through, normalised', () => {
    expect(safeHttpUrl(' https://example.com/a b ')).toBe(
      'https://example.com/a%20b',
    );
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
  });

  it('refuses everything that is not http or https', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('data:text/html,hi')).toBeUndefined();
    expect(safeHttpUrl('/relative/path')).toBeUndefined();
    expect(safeHttpUrl('not a url')).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});
