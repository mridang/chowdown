import { describe, expect, it } from '@jest/globals';

import { EditableTitle } from '@/app/(site)/recipe/[id]/_components/editable-title';
import { htmlAt } from '../../../../../components/render';

describe('EditableTitle', () => {
  const out = htmlAt(
    <EditableTitle recipeId="dal" title="Red lentil dal" etag={'"abc"'} />,
    { pathname: '/recipe/dal' },
  );

  it('keeps the title as the page’s one level-one heading', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Red lentil dal<\/h1>/);
  });

  it('offers a labelled pen button that does not submit anything', () => {
    expect(out).toMatch(/<button[^>]*aria-label="Edit title"/);
    expect(out).toMatch(/<button[^>]*type="button"/);
  });

  it('shows the pen on a touch screen, and on a mouse only for hover or focus', () => {
    expect(out).toContain('pointer-fine:opacity-0');
    expect(out).toContain('pointer-fine:group-hover:opacity-100');
    expect(out).toContain('pointer-fine:group-focus-within:opacity-100');
  });

  it('leaves the pen off the printed page', () => {
    expect(out).toContain('print:hidden');
  });

  it('starts with no text box open', () => {
    expect(out).not.toContain('<input');
    expect(out).not.toContain('<form');
  });
});
