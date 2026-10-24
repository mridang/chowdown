import { describe, expect, it } from '@jest/globals';

import {
  authorOf,
  AuthorLine,
  isAuthorKey,
  SourceLine,
} from '@/app/(site)/recipe/[id]/_components/byline';
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

describe('AuthorLine', () => {
  const out = html(<AuthorLine name="Ethan Chlebowski" />);

  it('says "by", then the name', () => {
    expect(out).toMatch(/>by<.*Ethan Chlebowski/);
  });

  it('sets the name in a handwriting face, and nothing else', () => {
    expect(out.match(/font-hand-/g)).toHaveLength(1);
    expect(out).toMatch(
      /class="[^"]*font-hand-\w+[^"]*"[^>]*>Ethan Chlebowski</,
    );
  });

  it('draws the name at the large size, under the title', () => {
    expect(out).toContain('leading-8');
  });

  it('keeps the same face for the same person, however the name is written', () => {
    const face = (name: string) =>
      /font-hand-(\w+)/.exec(html(<AuthorLine name={name} />))?.[1];
    expect(face('ethan  chlebowski')).toBe(face('Ethan Chlebowski'));
  });

  it('cuts a long name with an ellipsis instead of widening the line, and says it in full', () => {
    const long = 'A'.repeat(200);
    const longOut = html(<AuthorLine name={long} />);
    expect(longOut).toMatch(/class="[^"]*truncate[^"]*"/);
    expect(longOut).toContain(`title="${long}"`);
    expect(longOut).toContain('min-w-0');
  });

  it('shows a name as text, never as markup', () => {
    const hostile = html(<AuthorLine name={'<img src=x onerror=alert(1)>'} />);
    expect(hostile).not.toContain('<img');
    expect(hostile).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('SourceLine with a web address', () => {
  const out = html(<SourceLine url={SITE} />);

  it('links out to the original page, in a new tab', () => {
    expect(out).toContain(`href="${SITE}"`);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('From');
  });

  it('offers the other recipes saved from the same site, after the link', () => {
    expect(out).toContain('href="/app?site=seriouseats.com"');
    expect(out.indexOf('seriouseats.com</a>')).toBeLessThan(
      out.indexOf('More from seriouseats.com'),
    );
  });

  it('never uses a handwriting face, which is for people only', () => {
    expect(out).not.toContain('font-hand');
  });
});

describe('SourceLine with a typed source', () => {
  it('shows a source that is not a web address as plain text', () => {
    const out = html(<SourceLine value="Grandma" />);
    expect(out).toContain('Grandma');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('More from');
  });

  it('prefers the address when there is both an address and a typed source', () => {
    const out = html(
      <SourceLine value="Grandma" url="https://example.com/dal" />,
    );
    expect(out).toContain('example.com');
    expect(out).not.toContain('Grandma');
  });

  it('falls back to the typed source when the address is not a web address', () => {
    const out = html(<SourceLine value="Grandma" url="not a url" />);
    expect(out).toContain('Grandma');
    expect(out).not.toContain('href=');
  });
});

describe('SourceLine with no source', () => {
  it('shows nothing, so no gap is left', () => {
    expect(html(<SourceLine />)).toBe('');
  });

  it('shows nothing for an address that cannot be read and no typed source', () => {
    expect(html(<SourceLine url="not a url" />)).toBe('');
  });
});
