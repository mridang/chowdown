import { describe, expect, it } from '@jest/globals';

import {
  DRIVE_HOME_HREF,
  NEW_TAB,
  driveLink,
  driveOpenHref,
} from '@/components/site/drive-link';

describe('driveOpenHref', () => {
  it('opens the Recipes folder when its id is known', () => {
    expect(driveOpenHref('1AbC-dEf_9')).toBe(
      'https://drive.google.com/drive/folders/1AbC-dEf_9',
    );
  });

  it('opens Drive’s home page when the folder is not known', () => {
    expect(driveOpenHref(undefined)).toBe(DRIVE_HOME_HREF);
    expect(driveOpenHref('')).toBe(DRIVE_HOME_HREF);
  });

  it('never builds a link from something that is not shaped like a Drive id', () => {
    for (const bad of [
      '../../evil',
      'a/b',
      'abc?authuser=1',
      'abc#frag',
      'a b',
      'https://evil.test',
      '<script>',
      'abc\n',
    ]) {
      expect(driveOpenHref(bad)).toBe(DRIVE_HOME_HREF);
    }
  });
});

describe('driveLink', () => {
  it('starts connecting Drive, inside the app, until it is connected', () => {
    expect(driveLink({ driveConnected: false })).toEqual({
      label: 'Connect Google Drive',
      href: '/auth/drive',
      external: false,
    });
  });

  it('ignores a known folder while not connected', () => {
    expect(
      driveLink({ driveConnected: false, recipesFolderId: 'folder-1' }).href,
    ).toBe('/auth/drive');
  });

  it('opens the Recipes folder in a new tab once connected', () => {
    expect(
      driveLink({ driveConnected: true, recipesFolderId: 'folder-1' }),
    ).toEqual({
      label: 'Open Drive',
      href: 'https://drive.google.com/drive/folders/folder-1',
      external: true,
    });
  });

  it('falls back to Drive’s home page when connected without a known folder', () => {
    expect(driveLink({ driveConnected: true })).toMatchObject({
      href: DRIVE_HOME_HREF,
      external: true,
    });
  });

  it('refuses a folder id from a tampered or odd cookie', () => {
    expect(
      driveLink({ driveConnected: true, recipesFolderId: '../x?y' }).href,
    ).toBe(DRIVE_HOME_HREF);
  });
});

describe('NEW_TAB', () => {
  it('opens a new tab that cannot reach back to this page', () => {
    expect(NEW_TAB).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
  });
});
