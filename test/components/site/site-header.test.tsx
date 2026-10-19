import { describe, expect, it } from '@jest/globals';

import { SiteHeader } from '../../../src/components/site/site-header';
import type { ShellUser } from '../../../src/lib/auth/shell-user';
import { htmlAt } from '../render';

const ADA: ShellUser = {
  firstName: 'Ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  driveConnected: true,
};

describe('SiteHeader for a visitor', () => {
  const out = htmlAt(<SiteHeader user={null} />);

  it('links to the wordmark’s home page', () => {
    expect(out).toMatch(/<a [^>]*href="\/"[^>]*>.*chowdown/);
  });

  it('jumps to the landing page’s sections', () => {
    expect(out).toMatch(/<a [^>]*href="\/#features"[^>]*>Features<\/a>/);
    expect(out).toMatch(/<a [^>]*href="\/#faq"[^>]*>FAQ<\/a>/);
  });

  it('offers signing in with a plain link to the sign-in route', () => {
    expect(out).toMatch(
      /<a [^>]*href="\/api\/auth\/login"[^>]*>.*Sign in<\/a>/,
    );
  });

  it('has no account menu', () => {
    expect(out).not.toContain('Account menu');
  });
});

describe('SiteHeader for someone signed in', () => {
  it('shows the app links, the assistant call to action and the account menu', () => {
    const out = htmlAt(<SiteHeader user={ADA} />, { pathname: '/app' });
    expect(out).toMatch(/<a [^>]*href="\/app"[^>]*>Recipes<\/a>/);
    expect(out).toMatch(/<a [^>]*href="\/connect"[^>]*>.*Cook with AI<\/a>/);
    expect(out).toContain('Hi Ada');
    expect(out).not.toContain('Sign in');
  });

  it('offers adding a recipe once Drive is connected', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(/<a [^>]*href="\/recipes\/add"[^>]*>.*Add recipe<\/a>/);
    expect(out).not.toContain('Connect Google Drive');
  });

  it('offers connecting Drive instead, until it is', () => {
    const out = htmlAt(<SiteHeader user={{ ...ADA, driveConnected: false }} />);
    expect(out).toMatch(
      /<a [^>]*href="\/api\/auth\/drive"[^>]*>.*Connect Google Drive<\/a>/,
    );
    expect(out).not.toMatch(/>.*Add recipe<\/a>/);
  });
});
