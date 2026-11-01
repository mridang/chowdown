import { describe, expect, it } from '@jest/globals';

import TermsPage, { metadata } from '@/app/(site)/terms/page';
import { html } from '../../../components/render';

describe('TermsPage', () => {
  const out = html(<TermsPage />);

  it('has one heading, the terms’ title', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Terms of Service<\/h1>/);
  });

  it('covers use, recipes, AI, the service, the code, data and contact', () => {
    for (const heading of [
      'Using Chowdown',
      'Your recipes',
      'Artificial intelligence',
      'The service',
      'Open source',
      'Your data',
      'Contact',
    ]) {
      expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
    }
  });

  it('calls the AI import and tagging a best effort', () => {
    expect(out).toContain('are a best effort');
    expect(out).toContain('Check an imported recipe before you cook from it');
  });

  it('gives no warranty', () => {
    expect(out).toContain('without warranty of any kind');
  });

  it('names the licence and links to the code', () => {
    expect(out).toContain('Apache 2.0 licence');
    expect(out).toMatch(
      /<a [^>]*href="https:\/\/github\.com\/mridang\/chowdown"[^>]*>GitHub<\/a>/,
    );
  });

  it('sends people to the privacy policy for their data', () => {
    expect(out).toMatch(/<a [^>]*href="\/privacy"[^>]*>privacy policy<\/a>/);
  });

  it('gives the contact address', () => {
    expect(out).toContain('mridang.agarwalla@gmail.com');
  });

  it('links back home', () => {
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to Chowdown<\/a>/);
  });
});

describe('the terms page’s metadata', () => {
  it('may be indexed, unlike most pages', () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe('/terms');
  });

  it('has its own social card', () => {
    expect(metadata.openGraph?.url).toBe('/terms');
    expect(metadata.title).toBe('Terms');
    expect(metadata.twitter?.title).toBe('Terms · Chowdown');
  });
});
