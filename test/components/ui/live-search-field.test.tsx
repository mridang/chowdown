import { describe, expect, it } from '@jest/globals';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';

import { LiveSearchField } from '@/components/ui/live-search-field';
import { html } from '../render';

/** The field as it renders at an address, with the given query string. */
function at(search: string, field: ReactElement): string {
  return html(
    <NuqsTestingAdapter searchParams={search}>{field}</NuqsTestingAdapter>,
  );
}

describe('LiveSearchField', () => {
  it('starts with the text already in the address', () => {
    const out = at('?q=chicken+curry', <LiveSearchField />);
    expect(out).toMatch(/<input[^>]*value="chicken curry"/);
  });

  it('starts empty when the address has no text', () => {
    const out = at('?sort=time', <LiveSearchField />);
    expect(out).toMatch(/<input[^>]*value=""/);
  });

  it('is named after the parameter it keeps the text in', () => {
    expect(at('', <LiveSearchField />)).toMatch(/<input[^>]*name="q"/);
    expect(at('?find=soup', <LiveSearchField param="find" />)).toMatch(
      /<input[^>]*name="find"[^>]*value="soup"|<input[^>]*value="soup"[^>]*name="find"/,
    );
  });

  it('passes the rest of its props to the search box', () => {
    const out = at(
      '',
      <LiveSearchField placeholder="Search recipes" aria-label="Search" />,
    );
    expect(out).toContain('placeholder="Search recipes"');
    expect(out).toContain('aria-label="Search"');
    expect(out).toContain('type="search"');
  });

  it('is not busy until it has something to load', () => {
    expect(at('', <LiveSearchField />)).toMatch(/<input[^>]*aria-busy="false"/);
  });
});
