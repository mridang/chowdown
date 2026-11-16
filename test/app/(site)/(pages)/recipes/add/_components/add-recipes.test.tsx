import { describe, expect, it } from '@jest/globals';

import { AddRecipes } from '@/app/(site)/(pages)/recipes/add/_components/add-recipes';
import { html } from '../../../../../../components/render';

const TEXTAREA_ID_IMPORT = /<textarea[^>]*id="import-input"[^>]*><\/textarea>/;
const TEXTAREA_ID_IMPORT_2 =
  /<textarea[^>]*id="import-input"[^>]*>https:\/\/example.com\/pancakes<\/textarea>/;
const BUTTON_CLOSE_BUTTON = /<button[^>]*>.*Close<\/button>/;
const BUTTON_DISABLED_PREPARE =
  /<button[^>]*disabled=""[^>]*>Prepare recipes<\/button>/;
const TEXTAREA_ID_IMPORT_3 = /<textarea[^>]*id="import-input"/;
const LABEL_FOR_IMPORT =
  /<label[^>]*for="import-input"[^>]*>Links or recipe text<\/label>/;
const ROLE_STATUS_ARIA =
  /<p role="status" aria-live="polite"[^>]*empty:hidden[^>]*><\/p>/;
const H2_TABINDEX_ID = /<h2[^>]*tabindex="-1"[^>]*id="add-recipes-heading"/;
const H2_ID_ADD =
  /<h2[^>]*id="add-recipes-heading"[^>]*>Import links or text<\/h2>/;
const SECTION_ARIA_LABELLEDBY =
  /<section[^>]*aria-labelledby="add-recipes-heading"/;

describe('AddRecipes', () => {
  const out = html(
    <AddRecipes onClose={() => undefined} onSaved={() => undefined} />,
  );

  it('is a section named by its heading', () => {
    expect(out).toMatch(SECTION_ARIA_LABELLEDBY);
    expect(out).toMatch(H2_ID_ADD);
  });

  it('lets script move focus to the heading, without putting it in the Tab order', () => {
    expect(out).toMatch(H2_TABINDEX_ID);
  });

  it('has an empty polite live region ready, so progress can be announced', () => {
    expect(out).toMatch(ROLE_STATUS_ARIA);
  });

  it('offers no Cancel until something is running', () => {
    expect(out).not.toContain('>Cancel<');
  });

  it('shows no field error and does not mark the box invalid', () => {
    expect(out).not.toContain('aria-invalid');
  });

  it('starts by asking for links or text, in a labelled box', () => {
    expect(out).toMatch(LABEL_FOR_IMPORT);
    expect(out).toMatch(TEXTAREA_ID_IMPORT_3);
  });

  it('has a button to prepare the recipes, which cannot be pressed with nothing pasted', () => {
    expect(out).toMatch(BUTTON_DISABLED_PREPARE);
  });

  it('can be closed', () => {
    expect(out).toMatch(BUTTON_CLOSE_BUTTON);
  });

  it('shows no error and no later step yet', () => {
    expect(out).not.toContain('role="alert"');
    expect(out).not.toContain('Cooklang source');
    expect(out).not.toContain('Save &amp; next');
    expect(out).not.toContain('All done');
  });
});

describe('AddRecipes with something shared to the app', () => {
  const out = html(
    <AddRecipes
      initialInput="https://example.com/pancakes"
      onClose={() => undefined}
      onSaved={() => undefined}
    />,
  );

  it('starts the box with what was shared', () => {
    expect(out).toMatch(TEXTAREA_ID_IMPORT_2);
  });

  it('says where it came from, and that pressing the button is up to the person', () => {
    expect(out).toContain(
      'Shared from another app. Check it, then press Prepare recipes.',
    );
  });

  it('does not start preparing: nothing is busy and no Cancel is offered', () => {
    expect(out).toContain('Prepare recipes');
    expect(out).not.toContain('Preparing…');
    expect(out).not.toContain('>Cancel<');
  });

  it('has no hint, and an empty box, when nothing was shared', () => {
    const plain = html(
      <AddRecipes onClose={() => undefined} onSaved={() => undefined} />,
    );
    expect(plain).not.toContain('Shared from another app');
    expect(plain).toMatch(TEXTAREA_ID_IMPORT);
  });
});
