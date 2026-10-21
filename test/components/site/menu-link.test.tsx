import { describe, expect, it } from '@jest/globals';

import { MenuLink } from '../../../src/components/site/menu-link';
import { driveLink } from '../../../src/components/site/drive-link';
import { htmlAt } from '../render';

describe('MenuLink', () => {
  it('is an ordinary link inside the app', () => {
    const out = htmlAt(<MenuLink label="Recipes" href="/app" />);
    expect(out).toMatch(/<a [^>]*href="\/app"[^>]*>Recipes<\/a>/);
    expect(out).not.toContain('target=');
  });

  it('is a plain link to an API route', () => {
    const out = htmlAt(
      <MenuLink label="Connect Google Drive" href="/auth/drive" />,
    );
    expect(out).toContain('href="/auth/drive"');
  });

  it('shows the picture it is asked for, hidden from assistive technology', () => {
    const out = htmlAt(
      <MenuLink label="Favourites" href="/x" icon="favourites" />,
    );
    expect(out).toContain('<svg');
    expect(out).toContain('aria-hidden="true"');
  });

  it('shows no picture when none is asked for', () => {
    expect(htmlAt(<MenuLink label="FAQ" href="/#faq" />)).not.toContain('<svg');
  });

  it('opens an outside link in a new tab, with no handle back, and says so', () => {
    const out = htmlAt(
      <MenuLink
        {...driveLink({ driveConnected: true, recipesFolderId: 'folder-1' })}
        icon="drive"
      />,
    );
    expect(out).toContain(
      'href="https://drive.google.com/drive/folders/folder-1"',
    );
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('Open Drive');
    expect(out).toContain('(opens in a new tab)');
    expect(out).toContain('#2684fc');
  });

  it('uses the colour Drive logo for the Drive picture and a plain icon for the others', () => {
    expect(htmlAt(<MenuLink label="x" href="/x" icon="drive" />)).toContain(
      'fill="#0066da"',
    );
    expect(htmlAt(<MenuLink label="x" href="/x" icon="add" />)).not.toContain(
      '#0066da',
    );
  });
});
