import { describe, expect, it, jest } from '@jest/globals';

import manifest from '../../src/app/manifest';
import { SITE_URL } from '../../src/lib/site';
import { html } from '../components/render';

// next/font only works inside the Next compiler, and the stylesheet and the
// service-worker component are not what is under test.
const font = (options: { readonly variable: string }) => ({
  variable: `class-for${options.variable}`,
});
jest.unstable_mockModule('next/font/google', () => ({
  Inter: font,
  Bricolage_Grotesque: font,
  Caveat: font,
  Kalam: font,
  Shadows_Into_Light: font,
  Over_the_Rainbow: font,
  Indie_Flower: font,
  Delicious_Handrawn: font,
  La_Belle_Aurore: font,
}));
jest.unstable_mockModule('../../src/app/globals.css', () => ({}));
jest.unstable_mockModule('../../src/components/site/service-worker', () => ({
  ServiceWorker: () => null,
}));

const {
  default: RootLayout,
  metadata,
  viewport,
} = await import('../../src/app/layout');

describe('RootLayout', () => {
  it('is private by default, so only the public pages opt in to indexing', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('resolves relative addresses against the site', () => {
    expect(new URL(String(metadata.metadataBase)).origin).toBe(SITE_URL);
  });

  it('says the page language for Open Graph', () => {
    expect(metadata.openGraph).toMatchObject({ locale: 'en_US' });
  });

  it('asks for the light colour scheme, as the site has no dark theme', () => {
    expect(viewport.colorScheme).toBe('only light');
  });

  it('colours the browser bar like the installed app', () => {
    expect(viewport.themeColor).toBe(manifest().theme_color);
  });

  it('does not zoom-lock the page', () => {
    expect(viewport).toMatchObject({ width: 'device-width', initialScale: 1 });
    expect(viewport).not.toHaveProperty('maximumScale');
    expect(viewport).not.toHaveProperty('userScalable');
  });

  it('makes all seven handwriting faces available to the whole page, for people’s names', () => {
    const out = html(<RootLayout>{null}</RootLayout>);
    [
      'caveat',
      'kalam',
      'shadows',
      'rainbow',
      'indie',
      'handrawn',
      'aurore',
    ].forEach((face) =>
      expect(out).toContain(`class-for--font-hand-${face}-face`),
    );
  });

  it('lets an overflowing child show, rather than hiding it on the body', () => {
    const out = html(
      <RootLayout>
        <main>hello</main>
      </RootLayout>,
    );
    expect(out).toMatch(/<html lang="en"/);
    expect(out).toContain('<main>hello</main>');
    expect(out).not.toContain('overflow-x-hidden');
  });
});
