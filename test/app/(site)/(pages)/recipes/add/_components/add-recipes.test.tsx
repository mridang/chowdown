import { describe, expect, it } from '@jest/globals';

import { AddRecipes } from '../../../../../../../src/app/(site)/(pages)/recipes/add/_components/add-recipes';
import { html } from '../../../../../../components/render';

describe('AddRecipes', () => {
  const out = html(
    <AddRecipes onClose={() => undefined} onSaved={() => undefined} />,
  );

  it('is a section named by its heading', () => {
    expect(out).toMatch(/<section[^>]*aria-labelledby="add-recipes-heading"/);
    expect(out).toMatch(
      /<h2[^>]*id="add-recipes-heading"[^>]*>Import links or text<\/h2>/,
    );
  });

  it('lets script move focus to the heading, without putting it in the Tab order', () => {
    expect(out).toMatch(/<h2[^>]*tabindex="-1"[^>]*id="add-recipes-heading"/);
  });

  it('has an empty polite live region ready, so progress can be announced', () => {
    expect(out).toMatch(
      /<p role="status" aria-live="polite"[^>]*empty:hidden[^>]*><\/p>/,
    );
  });

  it('offers no Cancel until something is running', () => {
    expect(out).not.toContain('>Cancel<');
  });

  it('shows no field error and does not mark the box invalid', () => {
    expect(out).not.toContain('aria-invalid');
  });

  it('starts by asking for links or text, in a labelled box', () => {
    expect(out).toMatch(
      /<label[^>]*for="import-input"[^>]*>Links or recipe text<\/label>/,
    );
    expect(out).toMatch(/<textarea[^>]*id="import-input"/);
  });

  it('has a button to prepare the recipes, which cannot be pressed with nothing pasted', () => {
    expect(out).toMatch(
      /<button[^>]*disabled=""[^>]*>Prepare recipes<\/button>/,
    );
  });

  it('can be closed', () => {
    expect(out).toMatch(/<button[^>]*>.*Close<\/button>/);
  });

  it('shows no error and no later step yet', () => {
    expect(out).not.toContain('role="alert"');
    expect(out).not.toContain('Cooklang source');
    expect(out).not.toContain('Save &amp; next');
    expect(out).not.toContain('All done');
  });
});
