import { describe, expect, it, jest } from '@jest/globals';

import {
  askForAuthor,
  authorEvidence,
  cleanAuthorName,
  declaredAuthor,
  findAuthor,
  hasAuthor,
  looksLikeAPerson,
  withAuthor,
} from '../../../src/lib/recipe/author';

/** A page with the given head markup and body text. */
const page = (head: string, body = '') =>
  `<html><head>${head}</head><body>${body}</body></html>`;

/** An `application/ld+json` script. */
const ld = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

/** An env whose model answers `reply` (text or parsed JSON) and counts how often it is asked. */
function envReplying(reply: unknown) {
  const run = jest.fn(async () => ({ response: reply }));
  return { env: { AI: { run } } as unknown as Pick<CloudflareEnv, 'AI'>, run };
}

describe('cleanAuthorName', () => {
  it.each([
    ['Ethan Chlebowski', 'Ethan Chlebowski'],
    ['  Samin   Nosrat ', 'Samin Nosrat'],
    ['By Jane Cook', 'Jane Cook'],
    ['Recipe by Jane Cook', 'Jane Cook'],
    ['View all posts by Delicious Addiction', 'Delicious Addiction'],
    ['Jane Cook | Some Blog', 'Jane Cook'],
    ['Jane Cook - Some Blog', 'Jane Cook'],
    ['jehan yusoof', 'Jehan Yusoof'],
    ['NAGI SMITH', 'Nagi Smith'],
    ['TNN', 'TNN'],
    ['Hoàng Chí Thông', 'Hoàng Chí Thông'],
    ["Siobhán O'Brien", "Siobhán O'Brien"],
    ['Kevin and Amanda', 'Kevin and Amanda'],
    ['Tom &amp; Jerry', 'Tom & Jerry'],
  ])('keeps %p as %p', (raw, expected) => {
    expect(cleanAuthorName(raw)).toBe(expected);
  });

  it.each([
    'by',
    'By',
    '2015-09-04',
    '2 COMMENTS',
    '2 minutes',
    '1 minute',
    'admin',
    'Admin',
    'Editorial Team',
    'Staff',
    'https://example.com/jane',
    'jane@example.com',
    '@jane',
    'H. I',
    'J.',
    '',
    ' ',
    'Print Recipe',
    'Jump to Recipe',
    'x'.repeat(80),
    'one two three four five six',
  ])('refuses %p', (raw) => {
    expect(cleanAuthorName(raw)).toBeUndefined();
  });
});

describe('looksLikeAPerson', () => {
  it('accepts names and blogs named like people', () => {
    for (const name of [
      'Nagi',
      'Bong Eats',
      'Maunika Gowardhan',
      'Kevin and Amanda',
    ]) {
      expect(looksLikeAPerson(name)).toBe(true);
    }
  });

  it('refuses a web address', () => {
    expect(looksLikeAPerson('NerdyMamma.com')).toBe(false);
    expect(looksLikeAPerson('thriftandspice.co.uk')).toBe(false);
  });
});

describe('authorEvidence and declaredAuthor', () => {
  it('reads the author of the Recipe', () => {
    const html = page(
      ld({
        '@type': 'Recipe',
        name: 'Soup',
        author: { '@type': 'Person', name: 'Vanathy Shekhar' },
      }),
    );
    expect(authorEvidence(html).recipeAuthors).toEqual(['Vanathy Shekhar']);
    expect(declaredAuthor(authorEvidence(html))).toBe('Vanathy Shekhar');
  });

  it('reads the author of the Article when the Recipe has none, through an @id reference in a @graph', () => {
    const html = page(
      ld({
        '@graph': [
          { '@type': 'Recipe', name: 'Fajitas' },
          {
            '@type': 'Article',
            author: { '@id': 'https://x.test/#/schema/person/1' },
          },
          {
            '@type': 'Person',
            '@id': 'https://x.test/#/schema/person/1',
            name: 'Nagi',
          },
        ],
      }),
    );
    expect(authorEvidence(html).articleAuthors).toEqual(['Nagi']);
    expect(declaredAuthor(authorEvidence(html))).toBe('Nagi');
  });

  it('reads a meta author, and prefers the Recipe, then the Article, then the meta tag', () => {
    const meta = '<meta name="author" content="Liz Marino">';
    expect(declaredAuthor(authorEvidence(page(meta)))).toBe('Liz Marino');
    const both = page(
      `${meta}${ld({ '@type': 'Article', author: { name: 'Tyler Marino' } })}`,
    );
    expect(declaredAuthor(authorEvidence(both))).toBe('Tyler Marino');
    const all = page(
      `${meta}${ld({
        '@graph': [
          { '@type': 'Article', author: { name: 'Tyler Marino' } },
          { '@type': 'Recipe', author: 'Chantal Kirkland' },
        ],
      })}`,
    );
    expect(declaredAuthor(authorEvidence(all))).toBe('Chantal Kirkland');
  });

  it('reads the article:author property', () => {
    expect(
      declaredAuthor(
        authorEvidence(
          page('<meta property="article:author" content="Dan Toombs">'),
        ),
      ),
    ).toBe('Dan Toombs');
  });

  it('joins several authors of one piece', () => {
    const html = page(
      ld({
        '@type': 'Recipe',
        author: [
          { name: 'Jesse Szewczyk' },
          { name: 'Pierce Abernathy' },
          { name: 'Claire King' },
        ],
      }),
    );
    expect(declaredAuthor(authorEvidence(html))).toBe(
      'Jesse Szewczyk, Pierce Abernathy and Claire King',
    );
  });

  it('skips junk and a web address and moves on to the next source', () => {
    const html = page(
      `<meta name="author" content="NerdyMamma.com">${ld({ '@type': 'Article', author: 'by' })}`,
    );
    expect(declaredAuthor(authorEvidence(html))).toBeUndefined();
  });

  it('gathers what the model will be shown: title, site, description, bylines, opening text', () => {
    const html = page(
      `<title>Kori Ghassi | Maunika Gowardhan</title><meta property="og:site_name" content="Maunika Gowardhan"><meta name="description" content="A chicken curry.">`,
      '<h1>Kori Ghassi</h1><p>Recipe by Maunika Gowardhan</p>',
    );
    const evidence = authorEvidence(html);
    expect(evidence.title).toBe('Kori Ghassi | Maunika Gowardhan');
    expect(evidence.siteName).toBe('Maunika Gowardhan');
    expect(evidence.description).toBe('A chicken curry.');
    expect(evidence.bylines).toEqual(['Maunika Gowardhan']);
    expect(evidence.openingText).toContain('Kori Ghassi');
  });

  it('falls back to the structured data site name when there is no og:site_name', () => {
    expect(
      authorEvidence(page(ld({ '@type': 'WebSite', name: 'Bong Eats' })))
        .siteName,
    ).toBe('Bong Eats');
  });

  it('survives hostile structured data and pages without being slow', () => {
    const started = Date.now();
    const deep = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    authorEvidence(page(`<script type="application/ld+json">${deep}</script>`));
    authorEvidence(
      page(
        ld({ '@type': 'Article', author: { '@id': '#a' } }) +
          ld({ '@id': '#a', author: { '@id': '#a' } }),
      ),
    );
    authorEvidence(
      `${'<meta name="author" content="a">'.repeat(5000)}${'by '.repeat(50_000)}`,
    );
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('askForAuthor', () => {
  const evidence = authorEvidence(
    page(
      '<title>Kori Ghassi | Indian Recipes | Maunika Gowardhan</title><meta property="og:site_name" content="Maunika Gowardhan">',
    ),
  );

  it("returns the model's answer when it is a clean name the page really contains", async () => {
    const { env } = envReplying(
      '{"author": "Maunika Gowardhan", "reason": "Site named after owner"}',
    );
    expect(await askForAuthor(evidence, env)).toBe('Maunika Gowardhan');
  });

  it('accepts a reply that arrives already parsed, or with text around the JSON', async () => {
    expect(
      await askForAuthor(
        evidence,
        envReplying({ author: 'Maunika Gowardhan' }).env,
      ),
    ).toBe('Maunika Gowardhan');
    expect(
      await askForAuthor(
        evidence,
        envReplying('Sure! {"author":"Maunika Gowardhan"}').env,
      ),
    ).toBe('Maunika Gowardhan');
  });

  it('refuses a name that is not in what it was shown, so it can never invent one', async () => {
    const { env } = envReplying('{"author": "Julia Child"}');
    expect(await askForAuthor(evidence, env)).toBeUndefined();
  });

  it('matches names without regard to accents, case or spacing', async () => {
    const accented = authorEvidence(
      page('<title>Soup | Hoàng Chí Thông</title>'),
    );
    const { env } = envReplying('{"author": "Hoang Chi Thong"}');
    expect(await askForAuthor(accented, env)).toBe('Hoang Chi Thong');
  });

  it.each([
    '{"author": null}',
    '{"author": "admin"}',
    '{"author": "H. I"}',
    '{"author": "thriftandspice.com"}',
    '{"author": 7}',
    'I could not tell.',
    '',
  ])('gives nothing for %p', async (reply) => {
    expect(
      await askForAuthor(evidence, envReplying(reply).env),
    ).toBeUndefined();
  });

  it('gives nothing, and logs, when the model fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const env = {
      AI: {
        run: async () => {
          throw new Error('down');
        },
      },
    } as unknown as Pick<CloudflareEnv, 'AI'>;
    expect(await askForAuthor(evidence, env)).toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows the model the page data and tells it to ignore instructions in it', async () => {
    const { env, run } = envReplying('{"author": null}');
    await askForAuthor(evidence, env);
    const [, input] = run.mock.calls[0] as unknown as [
      string,
      { messages: { role: string; content: string }[]; temperature: number },
    ];
    expect(input.messages[0]?.content).toMatch(/ignore any instructions/i);
    expect(input.messages[1]?.content).toContain('Maunika Gowardhan');
    expect(input.temperature).toBe(0);
  });
});

describe('findAuthor', () => {
  it('uses what the page declares and does not ask the model', async () => {
    const { env, run } = envReplying('{"author": "Someone Else"}');
    const html = page('<meta name="author" content="Liz Marino">');
    expect(await findAuthor(html, env)).toBe('Liz Marino');
    expect(run).not.toHaveBeenCalled();
  });

  it('asks the model when the page declares nothing a person could be', async () => {
    const { env, run } = envReplying('{"author": "Chantal Kirkland"}');
    const html = page(
      '<meta name="author" content="NerdyMamma.com">',
      '<p>Recipe by Chantal Kirkland</p>',
    );
    expect(await findAuthor(html, env)).toBe('Chantal Kirkland');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('hasAuthor and withAuthor', () => {
  it('sees an author or by line', () => {
    expect(hasAuthor('>> title: T\n>> author: Jane Cook\n\nMix.')).toBe(true);
    expect(hasAuthor('>> by: Jane Cook\n')).toBe(true);
    expect(hasAuthor('>> title: T\n>> author: \n')).toBe(false);
    expect(hasAuthor('>> title: T\n')).toBe(false);
  });

  it('adds the author the page names to a recipe that has none', async () => {
    const { env } = envReplying('{"author": null}');
    const cook = await withAuthor(
      '>> title: Soup\n\nBoil @water{1%l}.\n',
      page('<meta name="author" content="Liz Marino">'),
      env,
    );
    expect(cook).toContain('>> author: Liz Marino');
    expect(cook).toContain('Boil @water{1%l}.');
  });

  it('leaves a recipe that already has an author alone, without asking anyone', async () => {
    const { env, run } = envReplying('{"author": "Other Person"}');
    const cook = '>> author: Jane Cook\n\nBoil.\n';
    expect(
      await withAuthor(
        cook,
        page('<meta name="author" content="Liz Marino">'),
        env,
      ),
    ).toBe(cook);
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves a recipe alone when no author can be found', async () => {
    const { env } = envReplying('{"author": null}');
    const cook = '>> title: Soup\n\nBoil.\n';
    expect(await withAuthor(cook, page('<title>Soup</title>'), env)).toBe(cook);
  });
});
