import { describe, expect, it } from '@jest/globals';

import {
  authorOf,
  Byline,
  isAuthorKey,
} from '../../../../../../src/app/(site)/recipe/[id]/_components/byline';
import { html } from '../../../../../components/render';

const SITE = 'https://www.seriouseats.com/recipes/dal';

describe('authorOf', () => {
  it('reads the author, trimmed', () => {
    expect(authorOf([['author', '  Ethan Chlebowski ']])).toBe(
      'Ethan Chlebowski',
    );
  });

  it('also reads "by", whatever its case or spacing', () => {
    expect(authorOf([['By', 'Nigella']])).toBe('Nigella');
    expect(authorOf([['AUTHOR', 'Nigella']])).toBe('Nigella');
  });

  it('prefers "author" over "by", as the structured data does', () => {
    expect(
      authorOf([
        ['by', 'Someone'],
        ['author', 'Nigella'],
      ]),
    ).toBe('Nigella');
  });

  it('skips an empty author for a later one, and is undefined without any', () => {
    expect(
      authorOf([
        ['author', '   '],
        ['by', 'Nigella'],
      ]),
    ).toBe('Nigella');
    expect(authorOf([['author', ' ']])).toBeUndefined();
    expect(authorOf([['servings', '4']])).toBeUndefined();
    expect(authorOf([])).toBeUndefined();
  });
});

describe('isAuthorKey', () => {
  it('knows the keys that name an author', () => {
    expect(isAuthorKey('author')).toBe(true);
    expect(isAuthorKey('Author')).toBe(true);
    expect(isAuthorKey('by')).toBe(true);
    expect(isAuthorKey('yield')).toBe(false);
    expect(isAuthorKey('authority')).toBe(false);
  });
});

describe('Byline with a source and an author', () => {
  const out = html(<Byline url={SITE} author="Ethan Chlebowski" />);

  it('links out to the original page, in a new tab', () => {
    expect(out).toContain(`href="${SITE}"`);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('From');
  });

  it('names the author after the source, with a lower-case "by"', () => {
    expect(out).toMatch(/seriouseats\.com.*by.*Ethan Chlebowski/);
  });

  it('sets the author in the handwriting face', () => {
    expect(out).toMatch(
      /<span[^>]*class="font-hand[^"]*"[^>]*>Ethan Chlebowski</,
    );
  });

  it('keeps the handwriting for the name alone', () => {
    expect(out.match(/font-hand/g)).toHaveLength(1);
  });

  it('still offers the other recipes from the same site, after the author', () => {
    expect(out).toContain('href="/app?site=seriouseats.com"');
    expect(out.indexOf('Ethan Chlebowski')).toBeLessThan(
      out.indexOf('More from seriouseats.com'),
    );
  });

  it('cuts a long name with an ellipsis instead of widening the line, and says it in full', () => {
    const long = 'A'.repeat(200);
    const longOut = html(<Byline url={SITE} author={long} />);
    expect(longOut).toMatch(/class="[^"]*truncate[^"]*"/);
    expect(longOut).toContain(`title="${long}"`);
    expect(longOut).toContain('min-w-0');
  });

  it('shows a name as text, never as markup', () => {
    const hostile = html(
      <Byline url={SITE} author={'<img src=x onerror=alert(1)>'} />,
    );
    expect(hostile).not.toContain('<img');
    expect(hostile).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('Byline with only a source', () => {
  it('offers the other recipes saved from the same site', () => {
    const out = html(<Byline url={SITE} />);
    expect(out).toContain('More from seriouseats.com');
    expect(out).not.toContain('font-hand');
    expect(out).not.toMatch(/>by</i);
  });

  it('shows a source that is not a web address as plain text', () => {
    const out = html(<Byline value="Grandma" />);
    expect(out).toContain('Grandma');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('More from');
  });

  it('prefers the address when there is both an address and a typed source', () => {
    const out = html(<Byline value="Grandma" url="https://example.com/dal" />);
    expect(out).toContain('example.com');
    expect(out).not.toContain('Grandma');
  });

  it('falls back to the typed source when the address is not a web address', () => {
    const out = html(<Byline value="Grandma" url="not a url" />);
    expect(out).toContain('Grandma');
    expect(out).not.toContain('href=');
  });
});

describe('Byline with a typed source and an author', () => {
  it('names both, without inventing a "More from" link', () => {
    const out = html(<Byline value="Grandma" author="Ada" />);
    expect(out).toContain('Grandma');
    expect(out).toContain('Ada');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('More from');
  });
});

describe('Byline with only an author', () => {
  const out = html(<Byline author="Ethan Chlebowski" />);

  it('opens with a capital "By", and has no link to offer', () => {
    expect(out).toContain('>By<');
    expect(out).not.toContain('>by<');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('From');
  });

  it('still sets the name in handwriting', () => {
    expect(out).toContain('font-hand');
  });
});

describe('Byline with neither', () => {
  it('shows nothing', () => {
    expect(html(<Byline />)).toBe('');
  });

  it('shows nothing for an address that cannot be read and no typed source', () => {
    expect(html(<Byline url="not a url" />)).toBe('');
  });
});
