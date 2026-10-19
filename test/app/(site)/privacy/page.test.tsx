import { describe, expect, it } from '@jest/globals';

import PrivacyPage, { metadata } from '../../../../src/app/(site)/privacy/page';
import { html } from '../../../components/render';

describe('PrivacyPage', () => {
  const out = html(<PrivacyPage />);

  it('has one heading, the policy’s title', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Privacy Policy<\/h1>/);
  });

  it('states what is accessed, what is stored and what is not done', () => {
    for (const heading of [
      'What we access',
      'What we store',
      'Artificial intelligence',
      'Links you paste',
      'Connected assistants',
      'Cookies and logs',
      'What we don’t do',
      'Deleting your data',
      'Contact',
    ]) {
      expect(out).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
    }
  });

  it('says recipe text goes to Cloudflare Workers AI, and what for', () => {
    expect(out).toContain('Cloudflare Workers AI');
    expect(out).toContain('picks tags, and makes the embeddings');
  });

  it('says embeddings are stored', () => {
    expect(out).toContain('embedding');
  });

  it('says pasted links are fetched by the server', () => {
    expect(out).toContain('chowdown’s server fetches that page');
  });

  it('describes connected assistants and where to disconnect them', () => {
    expect(out).toContain('consent screen');
    expect(out).toContain('disconnect any of them');
  });

  it('names the session cookie and says there are no tracking cookies', () => {
    expect(out).toContain('chowdown_session');
    expect(out).toContain('No advertising or analytics cookies');
  });

  it('mentions Cloudflare’s request logs', () => {
    expect(out).toContain(
      'Cloudflare, which hosts chowdown, records each request',
    );
  });

  it('offers self-service account deletion rather than asking people to email', () => {
    expect(out).toContain('Delete account');
    expect(out).not.toContain('and email us to delete your stored record');
    expect(out).toContain('Your <code');
  });

  it('names the narrow Drive permission', () => {
    expect(out).toContain('drive.file');
  });

  it('sends people to Google to remove access', () => {
    expect(out).toMatch(
      /<a [^>]*href="https:\/\/myaccount\.google\.com\/permissions"[^>]*>your Google account permissions<\/a>/,
    );
  });

  it('links back home', () => {
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to chowdown<\/a>/);
  });
});

describe('the privacy page’s metadata', () => {
  it('may be indexed, unlike most pages', () => {
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe('/privacy');
  });

  it('has its own social card', () => {
    expect(metadata.openGraph?.url).toBe('/privacy');
    expect(metadata.twitter?.title).toBe(metadata.title);
  });
});
