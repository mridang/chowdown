import { describe, expect, it } from '@jest/globals';

import { DeleteDialog } from '../../../src/components/recipe/delete-dialog';
import { htmlAt } from '../render';

const markup = (open: boolean) =>
  htmlAt(
    <DeleteDialog
      recipeId="dal"
      title="Dal"
      open={open}
      onOpenChange={() => undefined}
    />,
  );

describe('DeleteDialog', () => {
  it('shows nothing of the question while closed', () => {
    const out = markup(false);
    expect(out).toContain('<dialog');
    expect(out).not.toContain('Delete this recipe?');
  });

  it('is named by its question and described by what will happen', () => {
    const out = markup(true);
    expect(out).toMatch(/<h2[^>]*>Delete this recipe\?<\/h2>/);
    const labelled = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    expect(out).toContain(`id="${labelled}"`);
    expect(out).toContain('aria-describedby=');
  });

  it('names the recipe and says it can be restored from the Drive trash', () => {
    const out = markup(true);
    expect(out).toContain('Dal');
    expect(out).toContain('trash in your Google Drive');
  });

  it('offers Cancel and Delete recipe, and no corner close button', () => {
    const out = markup(true);
    expect(out).toContain('>Cancel</button>');
    expect(out).toContain('>Delete recipe</button>');
    expect(out).not.toContain('aria-label="Close"');
  });

  it('shows no error before anything has gone wrong', () => {
    expect(markup(true)).not.toContain('role="alert"');
  });
});
