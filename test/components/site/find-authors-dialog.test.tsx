import { describe, expect, it } from '@jest/globals';

import { FindAuthorsDialog } from '../../../src/components/site/find-authors-dialog';
import { html } from '../render';

const markup = (open: boolean) =>
  html(<FindAuthorsDialog open={open} onOpenChange={() => undefined} />);

describe('FindAuthorsDialog', () => {
  it('shows nothing of itself while closed', () => {
    const out = markup(false);
    expect(out).toContain('<dialog');
    expect(out).not.toContain('Find missing authors');
  });

  it('is named by its title and described by what it will do', () => {
    const out = markup(true);
    expect(out).toMatch(/<h2[^>]*>Find missing authors<\/h2>/);
    const labelled = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    expect(out).toContain(`id="${labelled}"`);
    expect(out).toContain('aria-describedby=');
    expect(out).toContain('what is found is kept');
  });

  it('offers Start and Cancel, with no corner close button', () => {
    const out = markup(true);
    expect(out).toContain('>Start</button>');
    expect(out).toContain('>Cancel</button>');
    expect(out).not.toContain('aria-label="Close"');
  });

  it('starts enabled, with an empty polite status line already in the page', () => {
    const out = markup(true);
    expect(out).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Start/);
    expect(out).toMatch(/<p role="status"[^>]*><\/p>/);
  });
});
