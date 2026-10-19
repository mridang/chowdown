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
    expect(out).toMatch(
      /<a [^>]*href="\/connect"[^>]*>.*Cook with AI<\/span><\/a>/,
    );
    expect(out).toContain('Hi Ada');
    expect(out).not.toContain('Sign in');
  });

  it('offers adding a recipe once Drive is connected', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(
      /<a [^>]*href="\/recipes\/add"[^>]*>.*Add recipe<\/span><\/a>/,
    );
  });

  it('keeps a Drive button once connected, opening Drive in a new tab', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(
      /<a [^>]*href="https:\/\/drive\.google\.com\/drive\/my-drive"[^>]*target="_blank"[^>]*>.*Open Drive/,
    );
    expect(out).not.toContain('Connect Google Drive');
  });

  it('opens the Recipes folder when the session knows it', () => {
    const out = htmlAt(
      <SiteHeader user={{ ...ADA, recipesFolderId: 'folder-1' }} />,
    );
    expect(out).toContain(
      'href="https://drive.google.com/drive/folders/folder-1"',
    );
  });

  it('never links to a folder id that is not a Drive id', () => {
    const out = htmlAt(
      <SiteHeader user={{ ...ADA, recipesFolderId: '"><script>x' }} />,
    );
    expect(out).not.toContain('/drive/folders/');
    expect(out).not.toContain('<script>');
  });

  it('offers connecting Drive instead, until it is', () => {
    const out = htmlAt(<SiteHeader user={{ ...ADA, driveConnected: false }} />);
    expect(out).toMatch(
      /<a [^>]*href="\/api\/auth\/drive"[^>]*>.*Connect Google Drive<\/span><\/a>/,
    );
    expect(out).not.toContain('Add recipe');
    expect(out).not.toContain('Open Drive');
  });

  it('marks "Cook with AI" with the AI sparkles, hidden from assistive technology', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(
      /<a [^>]*href="\/connect"[^>]*><svg[^>]*aria-hidden="true"[^>]*>.*<\/svg><span[^>]*>Cook with AI<\/span><\/a>/,
    );
  });

  it('folds the buttons’ words away on tablets, keeping them for screen readers', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toContain('<span class="md:max-lg:sr-only">Add recipe</span>');
    expect(out).toContain(
      '<span class="md:max-lg:sr-only">Cook with AI</span>',
    );
    expect(out).toContain('<span class="max-xl:sr-only">Open Drive</span>');
  });

  it('hides the Drive and Add recipe buttons on phones, where the menu has them', () => {
    const out = htmlAt(<SiteHeader user={ADA} />);
    expect(out).toMatch(
      /<a [^>]*class="[^"]*max-md:hidden[^"]*"[^>]*>.*Open Drive/,
    );
  });
});
