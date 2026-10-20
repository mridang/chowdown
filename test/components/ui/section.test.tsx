import { describe, expect, it } from '@jest/globals';

import { Section, SectionHeader } from '../../../src/components/ui/section';
import { classOf, html } from '../render';

describe('SectionHeader', () => {
  it('shows the eyebrow above the title, and an action beside them', () => {
    const out = html(
      <SectionHeader
        eyebrow="Weeknight"
        title="Easy and quick"
        action={<a href="/all">All</a>}
      />,
    );
    expect(out.indexOf('Weeknight')).toBeLessThan(
      out.indexOf('Easy and quick'),
    );
    expect(out).toContain('href="/all"');
  });

  it('has no eyebrow when none is given', () => {
    expect(html(<SectionHeader title="Only a title" />)).not.toContain(
      'uppercase',
    );
  });
});

describe('Section', () => {
  it('is a landmark band that header links can jump to', () => {
    const out = html(<Section id="faq">x</Section>);
    expect(out.startsWith('<section')).toBe(true);
    expect(out).toContain('id="faq"');
  });

  it('is the page colour unless told otherwise', () => {
    expect(classOf(html(<Section>x</Section>), 'section')).toContain(
      'bg-paper',
    );
    expect(
      classOf(html(<Section surface="white">x</Section>), 'section'),
    ).toContain('bg-white');
  });
});
