import { describe, expect, it } from '@jest/globals';

import { IntentLink } from '../../../src/components/ui/intent-link';
import { html } from '../render';

describe('IntentLink', () => {
  it('is an ordinary link to its address', () => {
    const out = html(<IntentLink href="/app">Recipes</IntentLink>);
    expect(out).toMatch(/^<a href="\/app"[^>]*>Recipes<\/a>$/);
  });

  it('passes the caller’s attributes on to the link', () => {
    const out = html(
      <IntentLink href="/app" aria-current="page" className="x">
        Recipes
      </IntentLink>,
    );
    expect(out).toContain('aria-current="page"');
    expect(out).toContain('class="x"');
  });

  it('can be switched off for links that go nowhere real', () => {
    expect(html(<IntentLink href="/demo" enabled={false} />)).toContain(
      'href="/demo"',
    );
  });

  it('can fetch its page at once', () => {
    expect(html(<IntentLink href="/app" eager />)).toContain('href="/app"');
  });
});
