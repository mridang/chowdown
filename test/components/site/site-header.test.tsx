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
  it('shows the app links and the account menu', () => {
    const out = htmlAt(<SiteHeader user={ADA} />, { pathname: '/app' });
    expect(out).toMatch(/<a [^>]*href="\/app"[^>]*>Recipes<\/a>/);
    expect(out).toContain('Hi Ada');
    expect(out).not.toContain('Sign in');
  });

  it('offers adding a recipe as the one highlighted button once Drive is connected', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(
      /<a [^>]*class="[^"]*bg-highlight[^"]*"[^>]*href="\/recipes\/add"[^>]*>.*Add recipe<\/a>/,
    );
  });

  it('keeps Drive and the assistant out of the header, in the account menu only', () => {
    const header = htmlAt(<SiteHeader user={ADA} />).split('Hi Ada')[0] ?? '';
    expect(header).not.toContain('Open Drive');
    expect(header).not.toContain('Cook with AI');
    expect(header).not.toContain('href="/connect"');
  });

  it('offers no Add recipe button until Drive is connected', () => {
    const out = htmlAt(<SiteHeader user={{ ...ADA, driveConnected: false }} />);
    expect(out).not.toContain('Add recipe');
  });

  it('hides the Add recipe button on phones, where the menu has it', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(
      /<a [^>]*class="[^"]*max-md:hidden[^"]*"[^>]*>.*Add recipe/,
    );
  });
});
