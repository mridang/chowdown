import { describe, expect, it } from '@jest/globals';

import { DeleteAccountDialog } from '../../../src/components/site/delete-account-dialog';
import { html } from '../render';

const markup = (open: boolean) =>
  html(<DeleteAccountDialog open={open} onOpenChange={() => undefined} />);

describe('DeleteAccountDialog', () => {
  it('shows nothing of the question while closed', () => {
    const out = markup(false);
    expect(out).toContain('<dialog');
    expect(out).not.toContain('Delete your account?');
  });

  it('is named by its question and described by what will happen', () => {
    const out = markup(true);
    expect(out).toMatch(/<h2[^>]*>Delete your account\?<\/h2>/);
    const labelled = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    expect(out).toContain(`id="${labelled}"`);
    expect(out).toContain('aria-describedby=');
  });

  it('says what goes, that Drive is untouched, and that it cannot be undone', () => {
    const out = markup(true);
    expect(out).toContain('everything chowdown keeps about you');
    expect(out).toContain('stay in your Google Drive');
    expect(out).toContain('cannot be undone');
  });

  it('offers Cancel and Delete my account, and no corner close button', () => {
    const out = markup(true);
    expect(out).toContain('>Cancel</button>');
    expect(out).toContain('>Delete my account</button>');
    expect(out).not.toContain('aria-label="Close"');
  });

  it('shows no error before anything has gone wrong', () => {
    expect(markup(true)).not.toContain('role="alert"');
  });
});
