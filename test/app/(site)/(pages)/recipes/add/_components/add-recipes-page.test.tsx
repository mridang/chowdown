import { describe, expect, it } from '@jest/globals';

import { AddRecipesPage } from '@/app/(site)/(pages)/recipes/add/_components/add-recipes-page';
import { htmlAt } from '../../../../../../components/render';

const BUTTON_TYPE_BUTTON = /<button[^>]*type="button"[^>]*>.*Write it myself/;
const BUTTON_TYPE_BUTTON_2 =
  /<button[^>]*type="button"[^>]*>.*Import links or text/;
const HREF_APP_ALL = /<a [^>]*href="\/app"[^>]*>.*All recipes<\/a>/;
const H1_TABINDEX_ADD = /<h1 tabindex="-1"[^>]*>Add recipes<\/h1>/;
const H1_ADD_RECIPES = /<h1[^>]*>Add recipes<\/h1>/;

describe('AddRecipesPage', () => {
  const out = htmlAt(<AddRecipesPage />, { pathname: '/recipes/add' });

  it('has the page’s one heading', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(H1_ADD_RECIPES);
  });

  it('lets focus come back to the heading when the choices are shown again', () => {
    expect(out).toMatch(H1_TABINDEX_ADD);
  });

  it('links back to all the recipes', () => {
    expect(out).toMatch(HREF_APP_ALL);
  });

  it('first asks how to add, offering to import or to write one by hand', () => {
    expect(out).toMatch(BUTTON_TYPE_BUTTON_2);
    expect(out).toMatch(BUTTON_TYPE_BUTTON);
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

describe('AddRecipesPage with something shared to the app', () => {
  const out = htmlAt(
    <AddRecipesPage sharedInput="https://example.com/pancakes" />,
    {
      pathname: '/recipes/add',
    },
  );

  it('skips the two choices and opens the importer with the share in it', () => {
    expect(out).not.toContain('Write it myself');
    expect(out).toContain('Links or recipe text');
    expect(out).toContain('https://example.com/pancakes</textarea>');
  });
});
