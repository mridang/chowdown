import { describe, expect, it } from '@jest/globals';

import { DriveButton } from '../../../src/components/site/drive-button';
import { driveLink } from '../../../src/components/site/drive-link';
import { classOf, html } from '../render';

describe('DriveButton before Drive is connected', () => {
  const out = html(
    <DriveButton link={driveLink({ driveConnected: false })} className="x" />,
  );

  it('offers to connect, through our own route, in the same tab', () => {
    expect(out).toMatch(
      /<a [^>]*href="\/api\/auth\/drive"[^>]*>.*Connect Google Drive<\/span><\/a>/,
    );
    expect(out).not.toContain('target=');
  });

  it('wears the Drive logo, hidden from assistive technology', () => {
    expect(out).toContain('<svg');
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('#ffba00');
  });

  it('keeps the layout classes it is given on top of the button look', () => {
    expect(classOf(out, 'a')).toContain('x');
    expect(classOf(out, 'a')).toContain('focus-ring');
  });
});

describe('DriveButton once Drive is connected', () => {
  const out = html(
    <DriveButton
      link={driveLink({ driveConnected: true, recipesFolderId: 'folder-1' })}
    />,
  );

  it('opens the Recipes folder in a new tab', () => {
    expect(out).toContain(
      'href="https://drive.google.com/drive/folders/folder-1"',
    );
    expect(out).toContain('target="_blank"');
  });

  it('gives the new page no handle back to this one', () => {
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('says "Open Drive", and tells screen readers it opens a new tab', () => {
    expect(out).toContain('Open Drive');
    expect(out).toContain('<span class="sr-only"> (opens in a new tab)</span>');
  });

  it('wears the same Drive logo', () => {
    expect(out).toContain('<svg');
    expect(out).toContain('aria-hidden="true"');
  });

  it('opens Drive’s home page when the folder is unknown or not a Drive id', () => {
    for (const recipesFolderId of [undefined, '"><b>']) {
      expect(
        html(
          <DriveButton
            link={driveLink({ driveConnected: true, recipesFolderId })}
          />,
        ),
      ).toContain('href="https://drive.google.com/drive/my-drive"');
    }
  });
});
