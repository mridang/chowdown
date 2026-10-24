import { describe, expect, it } from '@jest/globals';

import { scanHtml } from '@/domain/recipe/import-html-scan';

/** How long `work` takes, in milliseconds. */
function milliseconds(work: () => unknown): number {
  const started = performance.now();
  work();
  return performance.now() - started;
}

/** Pages built to make a backtracking pattern spend seconds; each must be read in a blink. */
const HOSTILE: Readonly<Record<string, string>> = {
  'repeated meta with content only': '<meta content="a" '.repeat(2000),
  'unterminated script starts': '<script '.repeat(25_000),
  'unterminated script starts with attributes': '<script a=b '.repeat(16_000),
  'unterminated ld+json scripts': '<script type="application/ld+json">'.repeat(
    30_000,
  ),
  'unterminated meta starts': '<meta property="og:image" '.repeat(8000),
  'brackets that never close': '<meta '.repeat(30_000) + '<'.repeat(30_000),
  'one tag with a huge run of spaces': `<meta ${' '.repeat(200_000)}>`,
  'one tag with a quote that never closes': `<meta a="${'b'.repeat(200_000)}>`,
  'many quotes that never close': `<meta ${'a=\'"'.repeat(60_000)}>`,
  'many equals signs': `<meta ${'a='.repeat(100_000)}>`,
  'a thousand closed scripts':
    '<script type="application/ld+json">{}</script>'.repeat(4000),
  'script ends with no start': '</script>'.repeat(20_000),
};

describe('scanHtml', () => {
  it('reads the attributes of meta tags, in either order and any quoting', () => {
    const { metas } = scanHtml(
      `<META Property="og:image" CONTENT='https://a.com/p.jpg' />
       <meta content=bare name = "og:image">`,
    );
    expect(metas.map((m) => Object.fromEntries(m))).toEqual([
      { property: 'og:image', content: 'https://a.com/p.jpg' },
      { content: 'bare', name: 'og:image' },
    ]);
  });

  it('keeps the first of a repeated attribute, as HTML does', () => {
    const [meta] = scanHtml('<meta content="one" content="two">').metas;
    expect(meta?.get('content')).toBe('one');
  });

  it('does not take <metadata> or <script-like> for the tags it wants', () => {
    const { metas, jsonLd } = scanHtml(
      '<metadata a="b"><scripts type="application/ld+json">{}</scripts>',
    );
    expect(metas).toEqual([]);
    expect(jsonLd).toEqual([]);
  });

  it('collects the text of JSON-LD scripts and only those', () => {
    const { jsonLd } = scanHtml(
      `<script>var a = 1;</script>
       <script type="application/ld+json">{"a":1}</script>
       <script type='Application/LD+JSON; charset=utf-8'>{"b":2}</script>
       <script type="text/javascript">{"c":3}</script>`,
    );
    expect(jsonLd).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('closes a script on an end tag in any case, with or without space', () => {
    const { jsonLd } = scanHtml(
      '<script type="application/ld+json">{"a":1}</SCRIPT ><script type="application/ld+json">{"b":2}</script>',
    );
    expect(jsonLd).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('treats what is inside a script as text, not as tags', () => {
    const { metas, jsonLd } = scanHtml(
      `<script type="application/ld+json">{"html":"<meta content='x' property='og:image'>"}</script>
       <script>document.write("<script type='application/ld+json'>{}")</script>
       <meta name="after" content="y">`,
    );
    expect(jsonLd).toHaveLength(1);
    expect(metas.map((m) => m.get('name'))).toEqual(['after']);
  });

  it('drops a script that is never closed, and a stray end tag', () => {
    expect(
      scanHtml('</script><script type="application/ld+json">{"a":1}').jsonLd,
    ).toEqual([]);
  });

  it('keeps at most 200 tags of each kind', () => {
    const { metas, jsonLd } = scanHtml(
      '<meta a=b>'.repeat(500) +
        '<script type="application/ld+json">{}</script>'.repeat(500),
    );
    expect(metas).toHaveLength(200);
    expect(jsonLd).toHaveLength(200);
  });

  it('is empty for text that has no tags at all', () => {
    expect(scanHtml('just a recipe\n\n2 eggs')).toEqual({
      metas: [],
      jsonLd: [],
    });
  });

  it.each(Object.entries(HOSTILE))(
    'reads %s in under 100 ms',
    (_name, page) => {
      expect(milliseconds(() => scanHtml(page))).toBeLessThan(100);
    },
  );
});
