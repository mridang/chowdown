import { describe, expect, it } from '@jest/globals';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';

import { LiveSearchField } from '@/components/ui/live-search-field';
import { html } from '../render';

const INPUT_ARIA_BUSY = /<input[^>]*aria-busy="false"/;
const INPUT_NAME_FIND =
  /<input[^>]*name="find"[^>]*value="soup"|<input[^>]*value="soup"[^>]*name="find"/;
const INPUT_NAME = /<input[^>]*name="q"/;
const INPUT_VALUE = /<input[^>]*value=""/;
const INPUT_VALUE_CHICKEN = /<input[^>]*value="chicken curry"/;

/** The field as it renders at an address, with the given query string. */
function at(search: string, field: ReactElement): string {
  return html(
    <NuqsTestingAdapter searchParams={search}>{field}</NuqsTestingAdapter>,
  );
}

describe('LiveSearchField', () => {
  it('starts with the text already in the address', () => {
    const out = at('?q=chicken+curry', <LiveSearchField />);
    expect(out).toMatch(INPUT_VALUE_CHICKEN);
  });

  it('starts empty when the address has no text', () => {
    const out = at('?sort=time', <LiveSearchField />);
    expect(out).toMatch(INPUT_VALUE);
  });

  it('is named after the parameter it keeps the text in', () => {
    expect(at('', <LiveSearchField />)).toMatch(INPUT_NAME);
    expect(at('?find=soup', <LiveSearchField param="find" />)).toMatch(
      INPUT_NAME_FIND,
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
    expect(at('', <LiveSearchField />)).toMatch(INPUT_ARIA_BUSY);
  });
});
