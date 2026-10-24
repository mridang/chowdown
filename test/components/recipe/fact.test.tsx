import { describe, expect, it } from '@jest/globals';

import { Fact } from '@/components/recipe/fact';
import { html } from '../render';

describe('Fact', () => {
  it('is a term and its description, for a definition list', () => {
    const out = html(
      <dl>
        <Fact icon={<svg />} label="Serves">
          4
        </Fact>
      </dl>,
    );
    expect(out).toContain('<dt');
    expect(out).toContain('Serves');
    expect(out).toContain('<dd');
    expect(out).toContain('>4<');
  });

  it('keeps the icon inside the term and hidden from assistive technology', () => {
    const out = html(
      <dl>
        <Fact icon={<svg />} label="Serves">
          4
        </Fact>
      </dl>,
    );
    const term = out.slice(out.indexOf('<dt'), out.indexOf('</dt>'));
    expect(term).toContain('<svg');
    expect(term).toContain('aria-hidden="true"');
  });
});
