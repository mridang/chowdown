import { describe, expect, it } from '@jest/globals';

import { MobileNav } from '../../../src/components/site/mobile-nav';
import { htmlAt } from '../render';

describe('MobileNav', () => {
  const out = htmlAt(
    <MobileNav links={[{ label: 'Recipes', href: '/app' }]} />,
  );

  it('is a menu button that starts closed', () => {
    expect(out).toMatch(/<button[^>]*aria-label="Menu"/);
    expect(out).toContain('aria-expanded="false"');
  });

  it('is hidden once the screen is wide enough for the header’s own links', () => {
    expect(out).toContain('md:hidden');
  });

  it('keeps its links out of the page until the menu is opened', () => {
    expect(out).not.toContain('href="/app"');
  });
});
