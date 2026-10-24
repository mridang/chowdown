import { describe, expect, it } from '@jest/globals';

import {
  decodeEntities,
  visibleText,
  withoutScriptsAndStyles,
} from '@/lib/recipe/html-text';

describe('decodeEntities', () => {
  it('reads the references that turn up in web text and leaves the rest', () => {
    expect(
      decodeEntities(
        'Tom &amp; Jerry&#39;s &quot;best&quot; &nbsp;pie &unknown;',
      ),
    ).toBe('Tom & Jerry\'s "best"  pie &unknown;');
  });
});

describe('withoutScriptsAndStyles', () => {
  it('cuts scripts, styles and other non-text blocks', () => {
    expect(
      withoutScriptsAndStyles(
        '<p>a</p><script>var x</script><p>b</p><STYLE>p{}</STYLE><svg><path/></svg><p>c</p>',
      ),
    ).toBe('<p>a</p><p>b</p><p>c</p>');
  });

  it('drops everything after a script that is never closed', () => {
    expect(withoutScriptsAndStyles('<p>a</p><script>never ends <p>b</p>')).toBe(
      '<p>a</p>',
    );
  });
});

describe('visibleText', () => {
  it('is the words a reader sees, collapsed, with tags as spaces', () => {
    expect(
      visibleText(
        '<h1>Soup</h1><p>Made by <a href="/x">Jane&nbsp;Cook</a></p><script>x()</script>',
        200,
      ),
    ).toBe('Soup Made by Jane Cook');
  });

  it('stops at the limit', () => {
    expect(visibleText(`<p>${'word '.repeat(100)}</p>`, 20)).toHaveLength(20);
  });

  it('stays fast on hostile pages', () => {
    const started = Date.now();
    visibleText('<script '.repeat(50_000), 100);
    visibleText('<'.repeat(200_000), 100);
    visibleText('<p '.repeat(100_000), 100);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
