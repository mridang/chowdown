import { describe, expect, it } from '@jest/globals';

import { AddRecipesPage } from '../../../../../../../src/app/(site)/(pages)/recipes/add/_components/add-recipes-page';
import { htmlAt } from '../../../../../../components/render';

describe('AddRecipesPage', () => {
  const out = htmlAt(<AddRecipesPage />, { pathname: '/recipes/add' });

  it('has the page’s one heading', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Add recipes<\/h1>/);
  });

  it('links back to all the recipes', () => {
    expect(out).toMatch(/<a [^>]*href="\/app"[^>]*>.*All recipes<\/a>/);
  });

  it('first asks how to add, offering to import or to write one by hand', () => {
    expect(out).toMatch(
      /<button[^>]*type="button"[^>]*>.*Import links or text/,
    );
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>.*Write it myself/);
  });

  it('describes each choice', () => {
    expect(out).toContain('Paste recipe links, markdown or plain text');
    expect(out).toContain('Type a recipe by hand in Cooklang');
  });

  it('does not show either flow before one is chosen', () => {
    expect(out).not.toContain('Recipe name');
    expect(out).not.toContain('Links or recipe text');
    expect(out).not.toContain('role="alert"');
  });
});
