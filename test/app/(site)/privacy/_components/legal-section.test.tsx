import { describe, expect, it } from '@jest/globals';

import {
  LegalItem,
  LegalSection,
} from '@/app/(site)/privacy/_components/legal-section';
import { classOf, html } from '../../../../components/render';

describe('LegalSection', () => {
  it('is a section headed by its title, followed by its content', () => {
    const out = html(
      <LegalSection title="What we store">
        <p>Your name.</p>
      </LegalSection>,
    );
    expect(out).toContain('<section>');
    expect(out).toMatch(/<h2[^>]*>What we store<\/h2>/);
    expect(out.indexOf('What we store')).toBeLessThan(
      out.indexOf('Your name.'),
    );
  });
});

describe('LegalItem', () => {
  it('is a list item with a decorative marker hidden from assistive technology', () => {
    const out = html(<LegalItem>Your email.</LegalItem>);
    expect(out).toContain('<li');
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('Your email.');
    expect(classOf(out, 'span')).toContain('bg-flame');
  });
});
