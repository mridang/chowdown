import { describe, expect, it } from '@jest/globals';

import { FindAuthorButton } from '../../../../../../src/app/(site)/recipe/[id]/_components/find-author-button';
import { htmlAt } from '../../../../../components/render';

describe('FindAuthorButton', () => {
  const out = htmlAt(
    <FindAuthorButton recipeId="abc" connectHref="/api/auth/drive" />,
    { pathname: '/recipe/abc' },
  );

  it('is a small text button, quiet beside the title', () => {
    expect(out).toMatch(
      /<button[^>]*type="button"[^>]*>Find the author<\/button>/,
    );
    expect(out).toContain('underline');
    expect(out).not.toContain('disabled=""');
  });

  it('has an empty status line in the page already, so the first message is announced', () => {
    expect(out).toMatch(/<p role="status"[^>]*><\/p>/);
  });

  it('is not printed', () => {
    expect(out).toContain('print:hidden');
  });

  it('shows no connect link before anything has gone wrong', () => {
    expect(out).not.toContain('Connect Google Drive');
  });
});
