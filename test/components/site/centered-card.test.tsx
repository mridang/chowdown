import { describe, expect, it } from '@jest/globals';

import { CenteredCard } from '../../../src/components/site/centered-card';
import { html } from '../render';

describe('CenteredCard', () => {
  it('sits its content in a white card on a bare page', () => {
    const out = html(
      <CenteredCard>
        <p>Approve?</p>
      </CenteredCard>,
    );
    expect(out).toContain('<main id="main"');
    expect(out).toContain('bg-white');
    expect(out).toContain('Approve?');
  });

  it('adds no card of its own when the content is already one', () => {
    const out = html(
      <CenteredCard framed={false}>
        <p>Connect Drive</p>
      </CenteredCard>,
    );
    expect(out).not.toContain('bg-white');
    expect(out).toContain('Connect Drive');
  });
});
